from flask import Flask,request,session,redirect,render_template_string
import sqlite3
app=Flask(__name__); app.secret_key='dev-secret'
def db():
 c=sqlite3.connect('app.db');c.row_factory=sqlite3.Row;c.execute('create table if not exists users(id integer primary key,name text unique,password text)');c.execute('create table if not exists notes(id integer primary key,user_id int,body text)');return c
@app.post('/register')
def register():
 c=db();c.execute('insert into users(name,password) values(?,?)',(request.form['name'],request.form['password']));c.commit();return 'ok'
@app.post('/login')
def login():
 c=db();q=f"select * from users where name='{request.form['name']}' and password='{request.form['password']}'";u=c.execute(q).fetchone();
 if not u:return 'bad',401
 session['uid']=u['id'];return redirect(request.args.get('next','/'))
@app.post('/note')
def note():
 c=db();c.execute('insert into notes(user_id,body) values(?,?)',(session.get('uid'),request.form['body']));c.commit();return 'ok'
@app.get('/')
def home():
 c=db();rows=c.execute('select body from notes where user_id=?',(session.get('uid'),)).fetchall();return render_template_string('<h1>Notes</h1>'+''.join('<p>'+r['body']+'</p>' for r in rows))
if __name__=='__main__':app.run(debug=True)
