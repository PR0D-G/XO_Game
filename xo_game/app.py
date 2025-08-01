from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

room_data = {}
players = {}

def generate_user_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/game')
def game():
    name = request.args.get('name')
    user_id = request.args.get('id')
    room = request.args.get('room')
    host = request.args.get('host') == 'true'

    if not name or not user_id or not room:
        return redirect(url_for('home'))

    return render_template('index.html', name=name, id=user_id, room=room, host=host)

@socketio.on('connect')
def on_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid in players:
        room = players[sid]['room']
        print(f"Player {players[sid]['name']} disconnected from room {room}")
        del players[sid]
        if room in room_data:
            room_data[room]['active'] = False
            room_data[room]['board'] = [""] * 9
            room_data[room]['current_player'] = "X"
        emit('player_disconnected', room=room)

@socketio.on('join_room')
def handle_join(data):
    sid = request.sid
    name = data.get('name')
    user_id = data.get('id')
    room = data.get('room')

    if not room or not name or not user_id:
        print(f"[⚠️ JOIN FAILED] Missing data from client: {data}")
        return

    if room not in room_data:
        room_data[room] = {
            'board': [""] * 9,
            'current_player': "X",
            'scores': {"X": 0, "O": 0},
            'active': False
        }

    room_players = [p for p in players.values() if p['room'] == room]
    if len(room_players) >= 2:
        print(f"[🚫 ROOM FULL] Player {name} ({user_id}) tried to join room {room}, but it's full.")
        emit('player_assigned', {'player': None, 'id': user_id, 'name': name}, room=sid)
        return

    symbol = 'X' if 'X' not in [p['symbol'] for p in room_players] else 'O'
    players[sid] = {'symbol': symbol, 'name': name, 'id': user_id, 'room': room}
    join_room(room)

    room_players = [p for p in players.values() if p['room'] == room]
    room_data[room]['active'] = len(room_players) == 2

    print(f"[✅ CONNECTED] {name} ({user_id}) joined room {room} as Player {symbol}")
    if not room_data[room]['active']:
        print(f"[⏳ WAITING] Waiting for second player to join room {room}...")

    emit('player_assigned', {
        'player': symbol,
        'id': user_id,
        'name': name
    }, room=sid)

    # ✅ Emit updated names after player is registered
    names = {
        'X': next((p['name'] for p in room_players if p['symbol'] == 'X'), 'Waiting...'),
        'O': next((p['name'] for p in room_players if p['symbol'] == 'O'), 'Waiting...')
    }
    emit('update_player_names', names, room=room)

    emit('game_status', {
        'active': room_data[room]['active'],
        'players_count': len(room_players),
        'board': room_data[room]['board'],
        'current_player': room_data[room]['current_player'],
        'scores': room_data[room]['scores']
    }, room=room)

@socketio.on('move')
def on_move(data):
    sid = request.sid
    idx = data.get('index')

    if sid not in players:
        return

    room = players[sid]['room']
    symbol = players[sid]['symbol']
    state = room_data[room]

    if not state['active'] or symbol != state['current_player'] or state['board'][idx] != "":
        return

    state['board'][idx] = symbol
    winner = check_winner(state['board'])
    draw = "" not in state['board']

    if winner:
        state['scores'][winner] += 1
        state['active'] = False
    elif draw:
        state['active'] = False
    else:
        state['current_player'] = "O" if symbol == "X" else "X"

    emit('update', {
        'board': state['board'],
        'current_player': state['current_player'],
        'winner': winner,
        'draw': draw,
        'scores': state['scores']
    }, room=room)

@socketio.on('reset')
def on_reset():
    sid = request.sid
    if sid not in players:
        return
    room = players[sid]['room']
    state = room_data[room]
    state['board'] = [""] * 9
    state['current_player'] = "X"
    state['active'] = len([p for p in players.values() if p['room'] == room]) >= 2
    emit('reset_board', room=room)

def check_winner(board):
    combos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ]
    for a, b, c in combos:
        if board[a] and board[a] == board[b] == board[c]:
            return board[a]
    return None

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
