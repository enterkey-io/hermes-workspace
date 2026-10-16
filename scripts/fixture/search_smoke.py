"""Read-only search against a real pinned native database, including older history."""
import hashlib
import os
from pathlib import Path
import sqlite3
import sys
import tempfile

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'plugins/bot-web'))
with tempfile.TemporaryDirectory(prefix='pebble-search-') as directory:
    home = Path(directory)
    os.environ.clear()
    os.environ.update(PATH=f'{Path(sys.executable).parent}:/usr/bin:/bin', HERMES_HOME=str(home), HERMES_NO_AUTO_INSTALL='1')
    from hermes_state import SessionDB
    from search_native import search_database
    db = SessionDB(db_path=home/'state.db')
    db.create_session('root', 'cli')
    db.set_session_title('root', 'Bot Chat')
    wanted = db.append_message('root', 'assistant', 'Sequoia old visible result')
    for i in range(1500):
        db.append_message('root', 'assistant', 'Later ordinary update '+str(i))
    db.append_message('root', 'tool', 'Sequoia tool payload is private')
    db.append_message('root', 'user', 'Sequoia hidden scaffold', display_kind='hidden')
    db.append_message('root', 'user', '[System: Sequoia internal scaffold]')
    inactive = db.append_message('root', 'user', 'Sequoia rewound text')
    db.close()
    with sqlite3.connect(home/'state.db') as fixture:
        fixture.execute('UPDATE messages SET active=0,compacted=0 WHERE id=?', (inactive,))
    before = hashlib.sha256((home/'state.db').read_bytes()).hexdigest()
    result = search_database(home, 'Sequoia')
    assert [r['id'] for r in result['hits']] == [str(wanted)], result
    assert before == hashlib.sha256((home/'state.db').read_bytes()).hexdigest()
    assert not result['limited']
    print('Native search: older visible message found; tool, hidden and rewind content excluded; database unchanged')
