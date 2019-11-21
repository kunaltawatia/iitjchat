var app = require('express')();
var http = require('http').Server(app);
var bodyParser = require('body-parser')

var io = require('socket.io')(http);
var session = require("express-session")({
  secret: "my-secret",
  resave: true,
  saveUninitialized: true
});
var sharedsession = require("express-socket.io-session");

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

app.use(bodyParser.json())

// Attach session
app.use(session);
// Share session with io sockets
io.use(sharedsession(session));

confessions = []
setInterval(() => {
  try {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db("omegle");
      dbo.collection("confessions").find({}).toArray(function (err, result) {
        if (err) throw err;
        new_confessions = result.reverse();
        if (new_confessions !== confessions) {
          confessions = new_confessions;
          io.emit('confessions', confessions);
        }
        db.close();
      });
    });
  }
  catch (err) {
    console.log(err);
  }
}, 3000);

// API for confessions
app.post('/confessions', (req, res) => {
  try {
    MongoClient.connect(url, function (err, db) {
      if (err) throw err;
      var dbo = db.db("omegle");
      dbo.collection("unapproved_confessions")
        .insertOne({
          message: req.body && req.body.message,
          owner: req.headers['x-forwarded-for'],
          time: Date.now()
        }, function (err, res) {
          if (err) throw err;
        });
    });
  }
  catch (err) {
    console.log(err);
  }
  res.end();
});
app.get('/confessions', (req, res) => {
  res.json(confessions);
})

// User Distribution Algorithm
incoming_pool = []
disconnected_users = []
talking_to = {}

setInterval(() => {
  // console.log(incoming_pool);
  // console.log(talking_to);
  if (incoming_pool.length) {
    processing_pool = incoming_pool.filter(el => {
      return !disconnected_users.includes(el);
    })
    incoming_pool = []
    processing_pool.sort(() => Math.random() - 0.5)
    var i
    for (i = 0; i < processing_pool.length - 1; i += 2) {
      A = processing_pool[i];
      B = processing_pool[i + 1];
      if (!talking_to[A].includes(B)) {
        io.to(A).emit('toUser', B);
        io.to(B).emit('toUser', A);
        talking_to[A].unshift(B);
        talking_to[B].unshift(A);
      }
      else {
        incoming_pool.push(A);
        incoming_pool.push(B);
      }
    }
    if (processing_pool.length % 2) {
      incoming_pool.push(processing_pool[i])
    }
  }
}, 1000);

function refresh_user(user) {
  if (user) {
    if (talking_to[user])
      talking_to[user].unshift(null);
    else
      talking_to[user] = [null];
    io.to(user).emit('toUser', '');
    incoming_pool.push(user);
  }
}

online_user_count = 0;
io.on('connection', function (socket) {

  if (!socket.handshake.session.userid) {
    socket.handshake.session.userid = Math.floor(Math.random() * 1000000) + '' + Date.now() % 1000000;
    socket.handshake.session.save();
    online_user_count = online_user_count + 1;
    io.emit('onlineUsers', online_user_count);
    refresh_user(socket.id);
  }

  socket.on('message', data => {
    const { to, message } = JSON.parse(data);
    if (disconnected_users.includes(to)) {
      refresh_user(socket.id);
    }
    else {
      socket.to(to).emit('message', JSON.stringify({ user: 'not_me', message: message }));
      socket.emit('message', JSON.stringify({ user: 'me', message: message }));
    }
  })

  socket.on('typingChange', to => {
    if (disconnected_users.includes(to)) {
      refresh_user(socket.id);
    }
    else {
      socket.to(to).emit('typingChange');
    }
  })

  socket.on('disconnectUser', () => {
    A = talking_to[socket.id][0]
    B = socket.id;
    refresh_user(A);
    refresh_user(B);
  });

  socket.on('disconnect', () => {
    refresh_user(talking_to[socket.id][0]);
    disconnected_users.push(socket.id);
    if (socket.handshake.session.userid) {
      delete socket.handshake.session.userid;
      socket.handshake.session.save();
    }
    online_user_count = online_user_count - 1;
    io.emit('onlineUsers', online_user_count);
  })
});

var port = process.env.PORT || 3000;
http.listen(port, function () {
  console.log('listening on port:' + port);
});
