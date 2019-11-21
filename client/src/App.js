import React, { Component } from 'react';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { Paper, TextField, Button } from '@material-ui/core';

import './App.css';

import client from "socket.io-client";

class App extends Component {
  render() {
    return (
      <Router>
        <Switch>
          <Route exact path="/">
            <Confessions />
          </Route>
          <Route path="/chat">
            <Chat />
          </Route>
        </Switch>
      </Router>
    )
  }
}

class Confessions extends Component {
  constructor() {
    super();
    this.state = {
      my_confession: '',
      confessions: []
    };
  }

  componentDidMount() {
    fetch('/confessions', {
      method: 'GET'
    })
      .then(response => {
        console.log(response);
        response.json().then(confessions => {
          this.setState({ confessions });
        });
      })
  }

  submit(e) {
    e.preventDefault();
    fetch('/confessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: this.state.my_confession })
    });
    this.setState({ my_confession: '' });
  }

  render() {
    return (
      <div class="root">
        <Paper class="base">
          <p>CONFESSIONS IIT J</p>
          <form onSubmit={this.submit.bind(this)}>
            <TextField placeholder="Confess your heart out :)" value={this.state.my_confession} onChange={(e) => { this.setState({ my_confession: e.target.value }) }} />
            <Button type="submit" onClick={this.submit.bind(this)}>Submit</Button>
          </form>
          <Paper style={{
            overflow: 'auto',
            maxHeight: "70vh"
          }}>
            {
              this.state.confessions.map(item => {
                return (
                  <p>{item.message} </p>
                )
              })
            }
          </Paper>
        </Paper>
      </div>
    );
  }
}

class Chat extends Component {
  constructor() {
    super();
    this.state = {
      chatting: false,
      toUser: '',
      message: '',
      chat: [],
      onlineUsers: 0,
      typing: false,
      incomingTyping: false
    };
  }
  socket = null

  componentDidMount() {
    this.socket = client('/');
    this.socket.on('toUser', (data) => {
      this.setState({ toUser: data, chat: [], incomingTyping: false });
    })
    this.socket.on('onlineUsers', (onlineUsers) => {
      this.setState({ onlineUsers });
    })
    this.socket.on('message', (message) => {
      this.setState({ incomingTyping: false, chat: [JSON.parse(message), ...this.state.chat] });
    })
    this.socket.on('typingChange', () => {
      this.setState({ incomingTyping: !this.state.incomingTyping })
    });
  }

  componentWillUnmount() {
    this.socket.disconnect();
  }

  submit(e) {
    e.preventDefault();
    const { toUser, message } = this.state;
    this.socket.emit('message', JSON.stringify({ to: toUser, message: message }));
    this.setState({ message: '' });
  }

  render() {
    const { toUser, onlineUsers, incomingTyping, message } = this.state;
    return (
      <div class="root">
        <Paper class="base">
          <p>ANONYMOUS CHAT IIT J</p>
          <p>Online Users:{onlineUsers}</p>
          {
            toUser.length ?
              <div>
                <form onSubmit={this.submit.bind(this)}>
                  <TextField
                    placeholder="Say Hi!"
                    value={message}
                    onChange={(e) => {
                      var text = e.target.value;
                      console.log(message, message.length);
                      console.log(text, text.length);
                      if (message.length == 0 && text.length > 0)
                        this.socket.emit('typingChange', toUser);
                      else if (text.length == 0)
                        this.socket.emit('typingChange', toUser);
                      this.setState({ message: text })
                    }} />
                  <Button type="submit" onClick={this.submit.bind(this)}>Submit</Button>
                </form>
                <Button type="Disconnect" onClick={() => this.socket.emit('disconnectUser')}>Disconnect User</Button>
                {incomingTyping ? <p>Stranger is typing...</p> : <p></p>}
                <Paper style={{
                  overflow: 'auto',
                  maxHeight: "70vh",
                }}>
                  {
                    this.state.chat.map(item => {
                      console.log(item);
                      return (
                        <p
                          style={{
                            color: item.user === 'me' ? 'black' : 'blue',
                            paddingLeft: 5
                          }}
                        >{item.message}</p>
                      )
                    })
                  }
                </Paper>
              </div>
              :
              <p>Searching for users</p>
          }
        </Paper>
      </div>
    );
  }
}

export default App;
