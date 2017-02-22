var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressValidator = require('express-validator');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('passport');
var mongoose = require('mongoose');
mongoose.connect('mongodb://Lukas:Inzynier2017@ds021036.mlab.com:21036/mydatabase');
var MongoDBStore = require('connect-mongodb-session')(session);
var routes = require('./routes/index');
var users = require('./routes/users');
var passportSocketIo = require("passport.socketio");
var favicon = require('serve-favicon');

var data = [];
var BidList = [];
var CardList = [];
var DeclarationList = [];
var GameList = [];
var Cards = [];
var RoomList = [];
var ComputerList = [];
var bidvalues = [];

for (var i = 1; i <=14; i++) {
    var newRoom = {
        number: i,
        place: 0,
        players: [],
        ids: [],
        type: 'people'
    };
    RoomList.push(newRoom);
}

for (var i = 15; i <= 18; i++) {
    var newRoom = {
        number: i,
        place: 0,
        players: [],
        ids: [],
        type: 'computer'
    };
    RoomList.push(newRoom);
}

createBidValues();
sortBidValues();
bidvalues = removeDuplicates(bidvalues);

var app = express();
// call socket.io to the app
app.io = require('socket.io')();

var store = new MongoDBStore(
    {
        uri: 'mongodb://Lukas:Inzynier2017@ds019996.mlab.com:19996/mongodb_session',
        collection: 'mysessions'
    });


app.use(session({
    secret: 'secret',
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: store,
    resave: true
}));


//Passport init
app.use(passport.initialize());
app.use(passport.session());

//express validator
app.use(expressValidator({
    errorFormatter: function (param, msg, value) {
        var namespace = param.split('.')
            , root = namespace.shift()
            , formParam = root;

        while (namespace.length) {
            formParam += '[' + namespace.shift() + ']';
        }
        return {
            param: formParam,
            msg: msg,
            value: value
        };
    }
}));

//Connect Flash
app.use(flash());

//Global variables
app.use(function (req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


//With Socket.io >= 1.0
app.io.use(passportSocketIo.authorize({
    cookieParser: cookieParser,       // the same middleware you registrer in express
    secret:       'secret',  // the session_secret to parse the cookie
    store:        store
}));

// start listen with socket.io
app.io.on('connection', function (socket) {
socket.from = 'start';
socket.room = 'none';
socket.login = socket.request.user.user.login;
socket.userid = socket.request.user.id;

        //chat
    socket.on('chat message', function (msg){
        socket.from = 'chat';
        var hours = new Date().getHours() + 1;
        var minutes = new Date().getMinutes();
        var seconds = new Date().getSeconds();
        if(hours < 10) hours = '0'+hours;
        if(minutes < 10) minutes = '0'+minutes;
        if(seconds < 10) seconds = '0'+seconds;
        var time= hours + ":" + minutes + ":" + seconds;
        socket.broadcast.emit('chat message', socket.login, msg, time);
        socket.emit('my message',  socket.login, msg, time);
    });

    //rooms
    socket.on('get rooms', function () {
        socket.from = 'rooms';
        socket.emit('rooms status', RoomList);
    });

    socket.on('take a sit', function (room){
       var objRoom = getRoomObj(room);
       if(objRoom.type.trim() === 'people') {
           if (objRoom.place < 3) {
               socket.from = 'inroom';
               var place = objRoom.place;
               place = place + 1;
               objRoom.place = place;
               socket.join('room' + room);
               socket.room = room;
               var players = objRoom.players;
               players.push(socket.login);
               var ids = objRoom.ids;
               ids.push(socket.userid);
               app.io.emit('rooms status', RoomList);
           }

           if (objRoom.place === 3) {
               socket.from = 'none';
               createGame(room);
               createPlayersPos(room);
               app.io.in('room' + room).emit('start game', room);
           }
       }else if(objRoom.type.trim() === 'computer'){
           if (objRoom.place < 2) {
               socket.from = 'cinroom';
               var place = objRoom.place;
               place = place + 1;
               objRoom.place = place;
               socket.join('room' + room);
               socket.room = room;
               var players = objRoom.players;
               players.push(socket.login);
               var ids = objRoom.ids;
               ids.push(socket.userid);
               app.io.emit('rooms status', RoomList);
           }

           if (objRoom.place === 2){
               socket.from = 'none';
               var players = objRoom.players;
               players.push('komputer');
               objRoom.players = players;
               createComputer(room);
               createGame(room);
               createPlayersPos(room);
               app.io.in('room' + room).emit('start game', room);
           }
       }
    });

    socket.on('stand', function (){
        var objRoom = getRoomObj(socket.room);
        var players = objRoom.players;
        var ids = objRoom.ids;

        for(var i=0;i<players.length;i++){
            if(players[i].trim() === socket.login){
                players = deleteFromArray(players, i);
                var place = objRoom.place;
                i = players.length;
                if(place > 0) {
                    place = place - 1;
                }
                objRoom.place = place;
            }
        }

        for(var i=0;i<ids.length;i++){
            if(ids[i].trim() === socket.userid){
                ids= deleteFromArray(ids, i);
            }
        }

        objRoom.players = players;
        objRoom.ids = ids;
        socket.leave('room'+socket.room);
        socket.room = 'none';
        socket.from = 'none';
        app.io.emit('rooms status', RoomList);
    });

    socket.on('disconnect', function () {
        var objRoom = getRoomObj(socket.room);
        var players = objRoom.players;
        var ids = objRoom.ids;
        switch(socket.from){
            case 'inroom'  :
                if(objRoom.place !== 3) {
                    socket.leave('room' + socket.room);
                    if (players !== undefined) {
                        for (var i = 0; i < players.length; i++) {
                            if (players[i].trim() === socket.login) {
                                players = deleteFromArray(players, i);
                                objRoom.players = players;
                                var place = objRoom.place;
                                place = place - 1;
                                objRoom.place = place;
                                i = players.length;
                            }
                        }
                        for(var j=0;j<ids.length;j++){
                            if(ids[j] === socket.userid){
                                ids = deleteFromArray(ids, j);
                                objRoom.ids = ids;
                                j = ids.length;
                            }
                        }
                    }
                    app.io.emit('rooms status', RoomList);
                }
                break;
            case 'cinroom'  :
                if(objRoom.place !== 2) {
                    socket.leave('room' + socket.room);
                    if (players !== undefined) {
                        for (var i = 0; i < players.length; i++) {
                            if (players[i].trim() === socket.login) {
                                players = deleteFromArray(players, i);
                                objRoom.players = players;
                                var place = objRoom.place;
                                place = place - 1;
                                objRoom.place = place;
                                i = players.length;
                            }
                        }
                        for(var j=0;j<ids.length;j++){
                            if(ids[j] === socket.userid){
                                ids = deleteFromArray(ids, j);
                                objRoom.ids = ids;
                                j = ids.length;
                            }
                        }
                    }
                    app.io.emit('rooms status', RoomList);
                }
                break;
            case 'leave' :
                socket.leave(socket.room);
                if (players !== undefined) {
                    for (var i = 0; i < players.length; i++) {
                        if (players[i].trim() === socket.login) {
                            players = deleteFromArray(players, i);
                            objRoom.players = players;
                            var place = objRoom.place;
                            place = place - 1;
                            objRoom.place = place;
                            i = players.length;
                        }
                    }
                    for(var j=0;j<ids.length;j++){
                        if(ids[j] === socket.userid){
                            ids = deleteFromArray(ids, j);
                            objRoom.ids = ids;
                            j = ids.length;
                        }
                    }
                }
                app.io.emit('rooms status', RoomList);
                break;
            case 'game' :
                socket.leave(socket.room);
                if (players !== undefined) {
                    for (var i = 0; i < players.length; i++) {
                        if (players[i].trim() === socket.login) {
                            players = deleteFromArray(players, i);
                            objRoom.players = players;
                            var place = objRoom.place;
                            place = place - 1;
                            objRoom.place = place;
                            i = players.length;
                        }
                    }
                    for(var j=0;j<ids.length;j++){
                        if(ids[j] === socket.userid){
                            ids = deleteFromArray(ids, j);
                            objRoom.ids = ids;
                            j = ids.length;
                        }
                    }
                }
                app.io.emit('rooms status', RoomList);
                app.io.in(socket.room).emit('leave message');
                break;
        }

    });

    //game
    socket.on('check if can be in room', function (room){
        var objRoom = getRoomObj(room);
        var ids = objRoom.ids;
        var exist = false;
        for(var i=0;i<ids.length;i++){
            if(socket.userid === ids[i]){
                exist = true;
                i = ids.length;
            }
        }
        if(exist === false){
          socket.emit('access forbbiden');
        }else{
            /*
             1. Jeżeli zbierze się 3 graczy dopiero wtedy losowane są karty i rozdzielane. Ma to zapobiec wielokrotnemu rozdawaniu kart
             */
            socket.join(room);
            socket.from = 'game';
            socket.room = room;
            var objRoom = getRoomObj(room);

            if(objRoom.type.trim() === 'people') {
                if (app.io.sockets.adapter.rooms[room].length == 3) {
                    var objGame = getGameObj(room);
                    app.io.in(room).emit('prepare game');
                    app.io.in(room).emit('pass players order', objGame.players, objGame.positions);
                    app.io.in(room).emit('ask for cards suit');
                    deleteCards(room);
                    Cards = generateCards(Cards);
                    Cards = shuffle(Cards);
                    dealCards(room, Cards);
                    deleteBid(room);
                    createBid(room);
                    deleteDeclaration(room);
                    createDeclaration(room);
                    var objBid = getBidObj(room);
                    app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                }
            }else if(objRoom.type.trim() === 'computer'){
                if (app.io.sockets.adapter.rooms[room].length == 2) {
                    var objGame = getGameObj(room);
                    var objComputer = getComputerObj(room);
                    app.io.in(room).emit('prepare game');
                    app.io.in(room).emit('pass players order', objGame.players, objGame.positions);
                    app.io.in(room).emit('ask for cards suit');
                    deleteCards(room);
                    Cards = generateCards(Cards);
                    Cards = shuffle(Cards);
                    dealCards(room, Cards);
                    var card = getCardsObj(room);
                    switch('komputer'){
                        case card.player1login.trim() :
                            objComputer.cards = card.player1;
                            break;
                        case card.player2login.trim() :
                            objComputer.cards = card.player2;
                            break;
                        case card.player3login.trim() :
                            objComputer.cards = card.player3;
                            break;
                    }

                    getComputerHand(objComputer.cards, room);
                    deleteBid(room);
                    createBid(room);
                    deleteDeclaration(room);
                    createDeclaration(room);
                    var objBid = getBidObj(room);
                    var objCards = getCardsObj(room);
                    if(objBid.q.trim() === objComputer.position.trim()){
                        if(objComputer.bid >= 18) {
                            objBid.bidvalue = objComputer.bid;
                            objBid.bidpos = getBidPosition(objComputer.bid.toString());
                            app.io.in(room).emit('ask bid', objBid.bidvalue, objBid.a);
                        }else{
                            socket.emit('computer pass', objComputer.position.trim());
                        }
                    }else {
                        app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                    }
                }
            }
        }
    });

    socket.on('send cards suit', function (){
        socket.emit('set cards suit', socket.request.user.user.suits);
        var objCards = getCardsObj(socket.room);
        socket.emit('send cards', objCards);
    });


    socket.on('bid value', function (room, bidvalue) {
        var objBid = getBidObj(room);
        var objComputer = getComputerObj(room);
        if (objBid.bidvalue <= bidvalue) {
            objBid.bidvalue = bidvalue;
            objBid.bidpos = getBidPosition(bidvalue.toString());
        }
        if(objComputer !== undefined && objComputer.position.trim() === objBid.a.trim()) {
            if(objComputer.bid > objBid.bidvalue){
                socket.emit('computer confirm bid value', objComputer.position.trim());
            }else{
                socket.emit('computer pass', objComputer.position.trim());
            }
        }else {
            app.io.in(room).emit('ask bid', bidvalue, objBid.a);
        }
    });

    socket.on('confirm bid value', function (room) {
        var objBid = getBidObj(room);
        var objComputer = getComputerObj(room);
        var val = getBidPosition(objBid.bidvalue);
        if(objComputer !== undefined && objComputer.position.trim() === objBid.q){
            if(objComputer.bid > objBid.bidvalue){
                app.io.in(room).emit('bid', bidvalues[val+1],bidvalues[val+2],bidvalues[val+3], objBid.q);
            }else{
                socket.emit('computer pass', objComputer.position.trim());
            }
        }else {
            app.io.in(room).emit('bid', bidvalues[val+1],bidvalues[val+2],bidvalues[val+3], objBid.q);
        }
    });

    socket.on('ask skat', function (room) {
    var objBid = getBidObj(room);
     if(objBid.bidwinner.trim() === 'komputer'){
         var objComputer = getComputerObj(room);
         var skatcards = [];
         var cards = [];
         var objCards = getCardsObj(room);
         var newskatcards = [];
         var newcards = [];
         for(var i=0;i<objComputer.cards.length;i++){
             cards.push(objComputer.cards[i].substr(objComputer.cards[i].indexOf("id")+3,2));
         }
         for(var j=0;j<objCards.skat.length;j++){
             skatcards.push(objCards.skat[j].substr(objCards.skat[j].indexOf("id")+3,2));
         }

         cards.push(skatcards[0]);
         cards.push(skatcards[1]);

         if(objComputer !== undefined){
             if(objComputer.pickskat.trim() === 'yes'){
                 //bierzemy karty i dodajemy do puli komputera on 2 wydaje
                 switch(objComputer.basic.trim()){
                     case 'clubs' :
                         var Jacks = searchJacks(cards);
                         if(Jacks.length > 0){
                             newcards = Jacks;
                         }
                         for(var i=0;i<cards.length;i++){
                             if(newcards.length < 10){
                                 if(cards[i].charAt(1) === 'C' && cards[i].charAt(0)!=='J'){
                                     newcards.push(cards[i]);
                                 }
                             }
                         }

                         var figures = [];
                         figures[0] = 'A';
                         figures[1] = 'T';
                         figures[2] = 'K';
                         figures[3] = 'Q';
                         figures[4] = '9';
                         figures[5] = '8';
                         figures[6] = '7';

                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newcards.length < 10) {
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'C') {
                                         newcards.push(cards[j]);
                                     }
                                 }else{
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'C') {
                                         newskatcards.push(cards[j]);
                                     }
                                 }
                             }
                         }


                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                     case 'spades':
                         var Jacks = searchJacks(cards);
                         if(Jacks.length > 0){
                             newcards = Jacks;
                         }
                         for(var i=0;i<cards.length;i++){
                             if(newcards.length < 10){
                                 if(cards[i].charAt(1) === 'S' && cards[i].charAt(0)!=='J'){
                                     newcards.push(cards[i]);
                                 }
                             }
                         }

                         var figures = [];
                         figures[0] = 'A';
                         figures[1] = 'T';
                         figures[2] = 'K';
                         figures[3] = 'Q';
                         figures[4] = '9';
                         figures[5] = '8';
                         figures[6] = '7';

                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newcards.length < 10) {
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'S') {
                                         newcards.push(cards[j]);
                                     }
                                 }else{
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'S') {
                                         newskatcards.push(cards[j]);
                                     }
                                 }
                             }
                         }


                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                     case 'hearts':
                         var Jacks = searchJacks(cards);
                         if(Jacks.length > 0){
                             newcards = Jacks;
                         }
                         for(var i=0;i<cards.length;i++){
                             if(newcards.length < 10){
                                 if(cards[i].charAt(1) === 'H' && cards[i].charAt(0)!=='J'){
                                     newcards.push(cards[i]);
                                 }
                             }
                         }

                         var figures = [];
                         figures[0] = 'A';
                         figures[1] = 'T';
                         figures[2] = 'K';
                         figures[3] = 'Q';
                         figures[4] = '9';
                         figures[5] = '8';
                         figures[6] = '7';

                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newcards.length < 10) {
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'H') {
                                         newcards.push(cards[j]);
                                     }
                                 }else{
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'H') {
                                         newskatcards.push(cards[j]);
                                     }
                                 }
                             }
                         }


                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                     case 'diamonds':
                         var Jacks = searchJacks(cards);
                         if(Jacks.length > 0){
                             newcards = Jacks;
                         }
                         for(var i=0;i<cards.length;i++){
                             if(newcards.length < 10){
                                 if(cards[i].charAt(1) === 'D' && cards[i].charAt(0)!=='J'){
                                     newcards.push(cards[i]);
                                 }
                             }
                         }

                         var figures = [];
                         figures[0] = 'A';
                         figures[1] = 'T';
                         figures[2] = 'K';
                         figures[3] = 'Q';
                         figures[4] = '9';
                         figures[5] = '8';
                         figures[6] = '7';

                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newcards.length < 10) {
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'D') {
                                         newcards.push(cards[j]);
                                     }
                                 }else{
                                     if (figures[i] === cards[j].charAt(0) && cards[j].charAt(1) !== 'D') {
                                         newskatcards.push(cards[j]);
                                     }
                                 }
                             }
                         }


                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                     case 'grand':
                         var figures = [];
                         figures[0] = 'J';
                         figures[1] = 'A';
                         figures[2] = 'T';
                         figures[3] = 'K';
                         figures[4] = 'Q';
                         figures[5] = '9';
                         figures[6] = '8';
                         figures[7] = '7';
                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newcards.length<10){
                                     if(figures[i] === cards[j].charAt(0)){
                                         newcards.push(cards[j]);
                                     }
                                 }else{
                                     if(figures[i] === cards[j].charAt(0)) {
                                         newskatcards.push(cards[j]);
                                     }
                                 }
                             }
                         }
                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                     case 'null' :
                         var figures = [];
                         figures[0] = 'J';
                         figures[1] = 'A';
                         figures[2] = 'T';
                         figures[3] = 'K';
                         figures[4] = 'Q';
                         figures[5] = '9';
                         figures[6] = '8';
                         figures[7] = '7';
                         for(var i=0;i<figures.length;i++){
                             for(var j=0;j<cards.length;j++){
                                 if(newskatcards.length < 2){
                                     if(figures[i] === cards[j].charAt(0)){
                                         newskatcards.push(cards[j]);
                                     }
                                 }else{
                                     if(figures[i] === cards[j].charAt(0)) {
                                         newcards.push(cards[j]);
                                     }
                                 }
                             }
                         }
                         cards = [];
                         skatcards = [];
                         var tempcards = objComputer.cards;
                         var tempskatcards = objCards.skat;
                         tempcards.push(tempskatcards[0]);
                         tempcards.push(tempskatcards[1]);
                         //zamiana z postaci id -> kartę
                         for(var i=0;i<newcards.length;i++){
                             for(var j=0;j<tempcards.length;j++) {
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newcards[i]) {
                                     cards.push(tempcards[j]);
                                 }
                             }
                         }

                         for(var i=0;i<newskatcards.length;i++){
                             for(var j=0;j<tempcards.length;j++){
                                 if (tempcards[j].substr(tempcards[j].indexOf("id") + 3, 2) === newskatcards[i]) {
                                     skatcards.push(tempcards[j]);
                                 }
                             }
                         }
                         objComputer.cards = cards;
                         break;
                 }
             }else{
                 skatcards = objCards.skat;

             }

             socket.emit('computer declared game',skatcards, objComputer.basic.trim(), objComputer.extra, objComputer.pickskat.trim());
             app.io.in(room).emit('update declared game', skatcards, objComputer.basic.trim(), objComputer.extra, objComputer.pickskat.trim());

             //do tego ustalenie czy pokazac karty
             if (objComputer.basic.trim() === 'null ouvert'  || objComputer.extra === 'ouvert'){
                 socket.emit('computer show declarer cards', objComputer.position.trim(), objComputer.cards);
             }
         }
        }else {
            app.io.in(room).emit('ask skat', objBid.bidwinner);
        }
    });

    socket.on('three passes', function (room) {
        app.io.in(room).emit('three passes');
    });


    socket.on('pass bid', function (room, passed) {
       var RoomObj = getRoomObj(room);
        switch(RoomObj.type.trim()){
            case 'people' : peoplePassBid(room, passed); break;
            case 'computer' :
                var objBid  = getBidObj(room);
                var objComputer = getComputerObj(room);

                if (objBid.first === null) {
                    objBid.first = passed;
                    switch(passed.trim()){
                        case 'srodek' :  objBid.q = 'zadek'; break;
                        case 'przodek':  objBid.q = 'zadek'; objBid.a = 'srodek'; break;
                    }

                    if (objBid.bidpos !== null) {
                        var val = objBid.bidpos;
                        app.io.in(room).emit('bid', bidvalues[val+1],bidvalues[val+2],bidvalues[val+3], objBid.q);
                    } else {
                        app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                    }

                    if( objBid.q.trim() === objComputer.position.trim()){
                        if(objComputer.bid >= 18 && objComputer.bid > objBid.bidvalue) {
                            objBid.bidvalue = objComputer.bid;
                            objBid.bidpos = getBidPosition(objComputer.bid.toString());
                            app.io.in(room).emit('ask bid', objBid.bidvalue, objBid.a);
                        }else{
                            socket.emit('computer pass', objComputer.position.trim());
                        }
                    }else {
                        if (objBid.bidpos !== null) {
                            var val = objBid.bidpos;
                            app.io.in(room).emit('bid', bidvalues[val+1],bidvalues[val+2],bidvalues[val+3], objBid.q);
                        } else {
                            app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                        }
                    }
                } else if (objBid.second === null) {
                    var objGame = getGameObj(room);
                    objBid.second = passed;
                    var positions = objGame.positions;
                    var players = objGame.players;
                    var temp = -1;

                    for (var i = 0; i < positions.length; i++) {
                        if (positions[i].trim() !== objBid.first.trim()) {
                            if (positions[i].trim() !== objBid.second.trim()) {
                                temp = i;
                                i = positions.length;
                            }
                        }
                    }
                    objBid.bidwinner = players[temp];
                    app.io.in(room).emit('bid winner', objBid.bidwinner);

                    if(objBid.bidwinner.trim() === 'komputer'){
                        if (objBid.first.trim() === 'srodek' && objBid.second.trim() === 'zadek' && objBid.bidpos === null) {
                            var objComputer = getComputerObj(room);
                            if(objComputer.bid >= 18){
                                objBid.bidvalue = 18;
                                objBid.bidpos = 0;
                                socket.emit('computer ask skat');
                            }else{
                                socket.emit('computer pass', objComputer.position.trim());
                            }
                        } else {
                            socket.emit('computer ask skat');
                        }
                    }else {
                        if (objBid.first.trim() === 'srodek' && objBid.second.trim() === 'zadek' && objBid.bidpos === null) {
                            app.io.in(room).emit('ask eighteen', objBid.bidwinner);
                        } else {
                            app.io.in(room).emit('ask skat', objBid.bidwinner);
                        }
                    }
                }else if(objBid.first !== null && objBid.second !== null){
                    app.io.in(room).emit('three passes');
                }
                break;
        }
    });

    socket.on('declared game', function (room, skatid, basic, extra, pickskat) {
        /*
        1. Zapisywana jest zadeklarowana gra, to czy podniesiono Skata
        2. Jeżeli została wysłana pozycja gracza oznacza to, że zadeklarowano grę gdzie pokazuje się karty.
         */
        var objGame = getGameObj(room);
        var objDeclaration = getDeclarationObj(room);
        var objBid = getBidObj(room);
        var objCards = getCardsObj(room);
        objDeclaration.pickskat = pickskat;
        objDeclaration.basic = basic;
        objCards.skat = skatid;
        objDeclaration.extra = extra;
        app.io.in(room).emit('set game data', objBid.bidwinner, objBid.bidvalue, objDeclaration.basic, objDeclaration.extra);
        var objComputer = getComputerObj(room);

        if(objComputer !== undefined && objGame.turn.trim() === objComputer.position.trim()){
            computerMove(room);
        }else {
            app.io.in(room).emit('turn', objGame.turn);
        }
    });

    socket.on('show declarer cards', function (room, position, newcards) {

           var objGame = getGameObj(room);
           var objCards = getCardsObj(room);
           var objBid = getBidObj(room);
            objGame.showcards = position.trim();
            switch (position.trim()) {
                case 'przodek':
                    objCards.player1 = newcards;
                    app.io.in(room).emit('show cards', objBid.bidwinner.trim(), objCards.player1); break;
                case 'srodek':
                    objCards.player2 = newcards;
                    app.io.in(room).emit('show cards', objBid.bidwinner.trim(), objCards.player2); break;
                case 'zadek':
                    objCards.player3 = newcards;
                    app.io.in(room).emit('show cards', objBid.bidwinner.trim(), objCards.player3); break;
            }
    });


    socket.on('update declarer cards', function (room, position, cards) {
        var objGame = getGameObj(room);
        objGame.turn = getTurn(objGame.turn);
        app.io.in(room).emit('turn', objGame.turn);
    });

    socket.on('next turn', function (room) {
        var objGame = getGameObj(room);
        objGame.turn = getTurn(objGame.turn);
        var objComputer = getComputerObj(room);
        if(objComputer !== undefined && objComputer.position.trim() === objGame.turn.trim()){
            computerMove(room);
        }else {
            app.io.in(room).emit('turn', objGame.turn);
        }
    });

    socket.on('send card', function (room, card) {
        // 1. Przesyłanie karty, którą wybrał gracz by pokazać ją innym graczom.
        var objCards = getCardsObj(room);

        if(objCards !== undefined){
            switch(socket.login.trim()){
                case objCards.player1login.trim() :
                    objCards.player1 = deleteChosenCard(objCards.player1, card);
                    objCards.firstmiddle = card;
                    break;
                case objCards.player2login.trim() :
                    objCards.player2 = deleteChosenCard(objCards.player2, card);
                    objCards.secondmiddle = card;
                    break;
                case objCards.player3login.trim() :
                    objCards.player3 = deleteChosenCard(objCards.player3, card);
                    objCards.thirdmiddle = card;
                    break;
            }
        }
        app.io.in(room).emit('send card', card, socket.login);
    });

    socket.on('add declarer cards', function (room, cards) {
            var objGame = getGameObj(room);
            var temp = objGame.deccards;
            if (temp === null) {
                temp = cards
            } else {
                for (var i = 0; i < cards.length; i++) {
                    temp.push(cards[i]);
                }
            }
            objGame.deccards = temp;
    });

    socket.on('add opponents cards', function (room, cards) {
        var objGame = getGameObj(room);
        var temp = objGame.oppcards;
        if (temp === null) {
            temp = cards
        } else {
            for (var i = 0; i < cards.length; i++) {
                temp.push(cards[i]);
            }
        }
        objGame.oppcards = temp;
    });

    socket.on('clear table', function (room) {
        var objCards = getCardsObj(room);
        objCards.firstmiddle = null;
        objCards.secondmiddle = null;
        objCards.thirdmiddle = null;
        var objGame = getGameObj(room);
        objGame.firstturn = null;
        app.io.in(room).emit('clear table');
    });

    socket.on('change turn', function (room, turn) {
        var objGame = getGameObj(room);
        var objComputer = getComputerObj(room);
        objGame.turn = turn;
        if(objComputer !== undefined && objGame.turn.trim() === objComputer.position.trim()){
            computerMove(room);
        }else {
            app.io.in(room).emit('turn', objGame.turn);
        }
    });

    socket.on('zero cards', function (room) {
        /*
        1. Zebranie informacji ilu graczy nie posiada już kart.
        2. Gdy kart nie posiada 3 graczy obliczane są punkty.
        3. Jeżeli zadeklarowana gra to null punkty są ustalone wg. zasad gry w Skata
        4. Jeżeli to inny typ gry punkty muszą być obliczone na podstawie kart.
        5. Wynik rozgrywki jest przedstawiony graczom.
         */
        var objGame = getGameObj(room);
        var people = objGame.zerocards;
        if (people === null) {
            var temp = [];
            temp[0] = socket.userid;
            objGame.zerocards = temp;
        } else {
            people.push(socket.userid);
            objGame.zerocards = people;
            if (people.length === 3) {
                checkWhoWin(room);
            }
        }
    });

    socket.on('first turn card', function (room, card, position) {
        // 1. Zapamiętywana jest pierwsza karta. Ma to znaczenie m.in przy ustalaniu czy reszta graczy może pojechać danym kolorem.
        var objGame = getGameObj(room);
        objGame.firstturn = card;
        objGame.firstmovepos = position;
        app.io.in(room).emit('first turn card', objGame.firstturn, objGame.firstmovepos);
    });

    socket.on('send card to hide', function (room, card) {
        app.io.in(room).emit('hide card', card, socket.login);
    });

    socket.on('end lost null game', function (room){
        // 1. Zakńczenie gry null - przegraną dla deklarującego grę.
        var objDeclaration = getDeclarationObj(room);
        var objBid = getBidObj(room);
        var points = 0;

        switch(objDeclaration.basic.trim()){
            case 'null':
                if(objDeclaration.pickskat.trim() === 'yes') points = -46;
                if(objDeclaration.pickskat.trim() === 'no') points = -70;
                break;
            case 'null ouvert':
                if(objDeclaration.pickskat.trim() === 'yes') points = -92;
                if(objDeclaration.pickskat.trim() === 'no') points = -118;
                break;
        }
        var result = 'Przegrał grę '+objDeclaration.basic;
        setTimeout(function(){
        app.io.in(room).emit('game result', objBid.bidwinner, '0', result, '0', '0', points);
        }, 1000);
        app.io.in(room).emit('update status', 'przegrana');
        app.io.in(room).emit('send stats');
    });

    socket.on('leave game', function (room){
        // 1. Użytkownik opuszcza grę - poprzez wybór
        socket.from = 'leave';
        deleteGame(room);
    });

    socket.on('checkColorTurnEnd client', function (room) {
        var objGame = getGameObj(room);
        var objCards = getCardsObj(room);
        checkColorTurnEnd(objGame, objCards, room);
    });

    socket.on('checkGrandTurnEnd client', function (room) {
        var objGame = getGameObj(room);
        var objCards = getCardsObj(room);
        checkGrandTurnEnd(objGame, objCards, room);
    });

    socket.on('checkNullTurnEnd client', function (room) {
        var objGame = getGameObj(room);
        var objCards = getCardsObj(room);
        checkNullTurnEnd(objGame, objCards, room);
    });

    socket.on('another one', function (room) {
        //Rozegranie kolejnej partii
        var objRoom = getRoomObj(room);
        var objGame = getGameObj(room);
        if (objGame !== undefined) {
            var ids = objRoom.ids;
            var replay = objGame.replay;
            for (var i = 0; i < ids.length; i++) {
                if (ids[i].trim() === socket.userid) {
                    if (replay[i] === false) {
                        replay[i] = true;
                    }
                    i = ids.length;
                }
            }

            objGame.replay = replay;
            var howmany = objGame.howmany;

            for (var i = 0; i < objGame.replay.length; i++) {
                if (objGame.replay[i] === true) {
                    howmany++;
                }
            }
        }
        if(objRoom.type.trim() === 'people') {
            if (objGame !== undefined) {
                if (howmany === 3) {
                    deleteCards(room);
                    deleteBid(room);
                    deleteDeclaration(room);
                    deleteGame(room);
                    createGame(room);
                    createPlayersPos(room);
                    var objGame = getGameObj(room);
                    app.io.in(room).emit('prepare game');
                    app.io.in(room).emit('pass players order', objGame.players, objGame.positions);
                    Cards = generateCards(Cards);
                    Cards = shuffle(Cards);
                    dealCards(room, Cards);
                    var objCards = getCardsObj(room);
                    app.io.in(room).emit('send cards', objCards);
                    createBid(room);
                    createDeclaration(room);
                    var objBid = getBidObj(room);
                    app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                }
            }
        }else{
            if (objGame !== undefined) {
                if (howmany === 2) {
                    deleteComputer(room);
                    createComputer(room);
                    deleteCards(room);
                    deleteBid(room);
                    deleteDeclaration(room);
                    deleteGame(room);
                    createGame(room);
                    createPlayersPos(room);
                    app.io.in(room).emit('prepare game');
                    app.io.in(room).emit('pass players order', objGame.players, objGame.positions);
                    app.io.in(room).emit('ask for cards suit');
                    deleteCards(room);
                    Cards = generateCards(Cards);
                    Cards = shuffle(Cards);
                    dealCards(room, Cards);
                    var card = getCardsObj(room);
                    var objComputer = getComputerObj(room);
                    switch('komputer'){
                        case card.player1login.trim() :
                            objComputer.cards = card.player1;
                            break;
                        case card.player2login.trim() :
                            objComputer.cards = card.player2;
                            break;
                        case card.player3login.trim() :
                            objComputer.cards = card.player3;
                            break;
                    }
                    getComputerHand(objComputer.cards, room);
                    deleteBid(room);
                    createBid(room);
                    deleteDeclaration(room);
                    createDeclaration(room);
                    var objBid = getBidObj(room);
                    var objCards = getCardsObj(room);
                    if(objBid.q.trim() === objComputer.position.trim()){
                        if(objComputer.bid >= 18) {
                            objBid.bidvalue = objComputer.bid;
                            objBid.bidpos = getBidPosition(objComputer.bid.toString());
                            app.io.in(room).emit('ask bid', objBid.bidvalue, objBid.a);
                        }else{
                            socket.emit('computer pass', objComputer.position.trim());
                        }
                    }else {
                        app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
                    }
                }
            }
        }
    });
});


function createPlayersPos(room){
    var objRoom = getRoomObj(room);
    var objGame = getGameObj(room);
    objGame.players = objRoom.players;
    objGame.players = shuffle(objGame.players);
    var positions = [];
    positions[0] = 'zadek';
    positions[1] = 'srodek';
    positions[2] = 'przodek';
    objGame.positions = positions;

    if(objRoom.type.trim() === 'computer'){
       var players = objGame.players;
        var temp = -1;
        var objComputer = getComputerObj(room);
        for(var i=0;i<players.length;i++){
            if(players[i].trim() === 'komputer'){
                temp = i;
                i = players.length;
            }
        }
        objComputer.position = positions[temp];
    }
}

function deleteFromArray(array, index){
    var newArray = [];
    for(var i=0;i<array.length;i++){
        if(i !== index){
            newArray.push(array[i]);
        }
    }
    return newArray;
}
function createBid(room){
    var NewBid = {
        room: room,
        first:null,
        second:null,
        bidvalue: 18,
        bidpos: null,
        bidwinner: null,
        q: 'srodek',
        a: 'przodek'
    };

    BidList.push(NewBid);
}

function createDeclaration(room){
    var NewDeclaration = {
        room: room,
        skatcards: null,
        pickskat: null,
        basic: null,
        extra: null
    };

    DeclarationList.push(NewDeclaration);
}

function createGame(room){
    var replay =[];
    replay[0] = false;
    replay[1] = false;
    replay[2] = false;

    var NewGame = {
        room: room,
        turn: 'przodek',
        deccards: null,
        zerocards: null,
        firstturn: null,
        oppcards: null,
        firstmovepos: 'przodek',
        showcards:null,
        players: [],
        positions: [],
        replay: replay,
        howmany: 0
    };

    GameList.push(NewGame);
}

function createComputer(room){
    var NewComputer = {
        room: room,
        position:null,
        bidvalue: 18,
        cards: [],
        basic:null,
        extra:null,
        pickskat:null
    };

    ComputerList.push(NewComputer);
}

function deleteComputer(room){
    var temp = [];
    for(var i=0;i<ComputerList.length;i++){
        if(ComputerList[i].room !== room){
            temp.push(ComputerList[i]);
        }
    }
    ComputerList = temp;
}

function deleteBid(room){
    var temp = [];
for(var i=0;i<BidList.length;i++){
    if(BidList[i].room !== room){
       temp.push(BidList[i]);
    }
}
BidList = temp;
}

function deleteDeclaration(room){
    var temp = [];
    for(var i=0;i<DeclarationList.length;i++){
        if(DeclarationList[i].room.trim() !== room.trim()){
            temp.push(DeclarationList[i]);
        }
    }
    DeclarationList = temp;
}

function deleteGame(room){
    var temp = [];
    for(var i=0;i<GameList.length;i++){
        if(GameList[i].room.trim() !== room.trim()){
            temp.push(GameList[i]);
        }
    }
    GameList = temp;
}

function deleteCards(room){
    Cards = [];
    var temp = [];
    for(var i=0;i<CardList.length;i++){
        if(CardList[i].room.trim() !== room.trim()){
            temp.push(CardList[i]);
        }
    }
    CardList = temp;
}

function shuffle(array) {
    var m = array.length, t, i;
    // While there remain elements to shuffle…
    while (m) {
        // Pick a remaining element…
        i = Math.floor(Math.random() * m--);
        // And swap it with the current element.
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}

function dealCards(room, cards){
    var player1 = [];
    var player2 = [];
    var player3 = [];
    var skat = [];

    //Rozdawanie kart po 3 kazdemu graczowi
    for (var i = 0; i <= 8; i++) {
        if (i % 3 == 0) player1.push(cards[i]);
        if (i % 3 == 1) player2.push(cards[i]);
        if (i % 3 == 2) player3.push(cards[i]);
    }

    //Rozdanie 2 kart do Skata
    skat.push(cards[9]);
    skat.push(cards[10]);

    //Rozdanie po 4 karty kazdemu graczowi
    for (var i = 11; i <= 22; i++) {
        if (i % 3 == 0) player1.push(cards[i]);
        if (i % 3 == 1) player2.push(cards[i]);
        if (i % 3 == 2) player3.push(cards[i]);
    }

    //Rozdanie 3 kart kazdemu graczowi
    for (i = 23; i <= 31; i++) {
        if (i % 3 == 0) player1.push(cards[i]);
        if (i % 3 == 1) player2.push(cards[i]);
        if (i % 3 == 2) player3.push(cards[i]);
    }

    var objGame = getGameObj(room);

    var NewCard = {
        room: room,
        player1login:objGame.players[0],
        player1: player1,
        player2login:objGame.players[1],
        player2: player2,
        player3login:objGame.players[2],
        player3: player3,
        skat:skat,
        firstmiddle:null,
        secondmiddle:null,
        thirdmiddle:null
    };

    CardList.push(NewCard);
}

function getCardsObj(room) {
    var obj;
    for (var i = 0; i < CardList.length; i++) {
        obj = CardList[i];
        if (obj.room === room) break;
    }
    return obj;
}

function generateCards(array) {
    var Colors = [];
    Colors[0] = "Clubs";
    Colors[1] = "Spades";
    Colors[2] = "Hearts";
    Colors[3] = "Diamonds";

    var Figures = [];
    Figures[0] = "A";
    Figures[1] = "J";
    Figures[2] = "K";
    Figures[3] = "Q";
    Figures[4] = "T";

    for (var i = 7; i <= 9; i++) {
        for (var j = 0; j < Colors.length; j++) {
            var p = '<img src=';
            var s = '/images/Cards/All/' + Colors[j] + '/' + i + 'o' + Colors[j].charAt(0);
            var e = ".png id=" + i + Colors[j].charAt(0) + ">";
            array.push(p + s + e);
        }
    }

    for (var k = 0; k < Figures.length; k++) {
        for (var j = 0; j < Colors.length; j++) {
            var p = '<img src=';
            var s = '/images/Cards/All/' + Colors[j] + '/' + Figures[k] + 'o' + Colors[j].charAt(0);
            var e = ".png id=" + Figures[k] + Colors[j].charAt(0) + ">";
            array.push(p + s + e);
        }
    }
    return array;
}

function getTurn(previousturn) {
    var temp = '';
    switch (previousturn) {
        case 'przodek':
            temp = 'zadek';
            break;
        case 'zadek':
            temp = 'srodek';
            break;
        case 'srodek':
            temp = 'przodek';
            break;
    }
    return temp;
}

function checkWhoWin(room) {
    /*
     1. Sprawdzenie czy deklarujacy gre posiada jakies karty. Jeżeli nie - przegrana na czarno
     2. Rozpoczynamy wyznaczenie układów aby móc obliczyć punkty.
     */

    var objGame = getGameObj(room);
    var objDeclaration = getDeclarationObj(room);
    var objBid = getBidObj(room);
    var objCards = getCardsObj(room);

    var typeofgame = '';
    var cards = objGame.deccards;
    var matadors = 0;
    var jacks = [];
    var color = [];
    var declarerpoints = 0;
    var enemypoints = 0;
    var enemycards = [];
    var data = [];
    var won = true;
    var value = 0;
    if (objDeclaration.basic.trim() === 'null' || objDeclaration.basic.trim() === 'null ouvert') {
        switch (objDeclaration.basic.trim()) {
            case 'null':
                if (objDeclaration.pickskat.trim() === 'yes') value = 23;
                if (objDeclaration.pickskat.trim() === 'no') value = 35;
                if (value < objBid.bidvalue) {
                    typeofgame = 'Przelicytowana';
                    won = false;
                    value *= -2;
                }
                var result = '';
                if (won !== false) {
                    result = 'Wygrał grę ' + objDeclaration.basic;
                    app.io.in(room).emit('update status', 'wygrana');
                } else {
                    result = 'Przegrał grę ' + objDeclaration.basic;
                    app.io.in(room).emit('update status', 'przegrana');
                }
                setTimeout(function() {
                app.io.in(room).emit('game result', objBid.bidwinner, '0', result, '0', '0', value);
                }, 1000);
                app.io.in(room).emit('send stats');
                break;
            case 'null ouvert':
                if (objDeclaration.pickskat.trim() === 'yes') value = 46;
                if (objDeclaration.pickskat.trim() === 'no') value = 59;
                if (value < objBid.bidvalue) {
                    typeofgame = 'Przelicytowana';
                    won = false;
                    value *= -2;
                }
                var result = '';
                if (won !== false) {
                    result = 'Wygrał grę ' + objDeclaration.basic;
                    app.io.in(room).emit('update status', 'wygrana');
                } else {
                    result = 'Przegrał grę ' + objDeclaration.basic;
                    app.io.in(room).emit('update status', 'przegrana');
                }
                setTimeout(function() {
                app.io.in(room).emit('game result', objBid.bidwinner, '0', result, '0', '0', value);
                 }, 1000);
                app.io.in(room).emit('send stats');
                break;
        }
    } else {
        if (cards !== null) {
            if (cards.length > 0) {
                switch (objDeclaration.basic.trim()) {
                    case 'grand':
                        var skat = objCards.skat;
                        for (var i = 0; i < skat.length; i++) {
                            cards.push(skat[i]);
                        }
                        jacks = searchJacks(cards);
                        jacks = orderJacks(jacks);
                        matadors = countJacks(jacks);
                        if (objDeclaration.extra !== null) matadors += countExtraPoints(objDeclaration.extra);
                        if (objDeclaration.pickskat.trim() === 'no') matadors++;
                        matadors++;//mnożnik za grę
                        declarerpoints = countPoints(cards);

                        enemycards = objGame.oppcards;
                        if (enemycards !== null) enemypoints = countPoints(enemycards);
                        data = getGameType(declarerpoints, enemypoints, enemycards, matadors);
                        typeofgame = data[0];
                        won = data[1];
                        matadors = data[2];

                        var value = countGameValue(objDeclaration.basic, matadors);
                        if (won !== false) {// jezeli nie przegrał to sprawdzamy czy nie przleicytował
                            var value = countGameValue(objDeclaration.basic, matadors);
                            if (value < objBid.bidvalue) {
                                typeofgame = 'Przelicytowana';
                                won = false;
                                value *= -2;
                            }
                        } else {
                            value *= -2;
                        }

                        if (won !== false) {
                            app.io.in(room).emit('update status', 'wygrana');
                        } else {
                            app.io.in(room).emit('update status', 'przegrana');
                        }
                        setTimeout(function() {
                        app.io.in(room).emit('game result', objBid.bidwinner, objBid.bidvalue, typeofgame, matadors, value, declarerpoints);
                        }, 1000);
                        app.io.in(room).emit('send stats');
                        break;

                    default :
                        if (objDeclaration.basic.trim() === 'clubs' ||
                            objDeclaration.basic.trim() === 'spades' ||
                            objDeclaration.basic.trim() === 'hearts' ||
                            objDeclaration.basic.trim() === 'diamonds') {
                            var skat = objCards.skat;
                            for (var i = 0; i < skat.length; i++) {
                                cards.push(skat[i]);
                            }
                            jacks = searchJacks(cards);
                            jacks = orderJacks(jacks);
                            matadors = countJacks(jacks);
                            color = orderByColor(cards, objDeclaration.basic.trim());
                            if(jacks.length !== 0){
                                if(jacks[0].charAt(1) === 'C'){
                                    matadors += countColorTrumps(sortColor(color));
                                }
                            }else if(matadors === 4){
                                matadors += countColorTrumps(sortColor(color));
                            }
                            if (objDeclaration.extra !== null) matadors += countExtraPoints(objDeclaration.extra);
                            if (objDeclaration.pickskat.trim() === 'no') matadors++;
                            matadors++;//mnożnik za grę
                            declarerpoints = countPoints(cards);

                            enemycards = objGame.oppcards;
                            if (enemycards !== null) enemypoints = countPoints(enemycards);
                            data = getGameType(declarerpoints, enemypoints, enemycards, matadors);
                            typeofgame = data[0];
                            won = data[1];
                            matadors = data[2];

                            var value = countGameValue(objDeclaration.basic, matadors);
                            if (won !== false) {// jezeli nie przegrał to sprawdzamy czy nie przleicytował
                                if (value < objBid.bidvalue) {
                                    typeofgame = 'Przelicytowana';
                                    won = false;
                                    value *= -2;
                                }
                            } else {
                                value *= -2;
                            }

                            if (won !== false) {
                                app.io.in(room).emit('update status', 'wygrana');
                            } else {
                                app.io.in(room).emit('update status', 'przegrana');
                            }
                            setTimeout(function() {
                            app.io.in(room).emit('game result', objBid.bidwinner, objBid.bidvalue, typeofgame, matadors, value, declarerpoints);
                             }, 1000);
                            app.io.in(room).emit('send stats');
                        }
                        break;
                }
            }
        } else {
            typeofgame = 'Przegrana na czarno';
            app.io.in(room).emit('update status', 'przegrana');
            setTimeout(function() {
            app.io.in(room).emit('game result', objBid.bidwinner, objBid.bidvalue, typeofgame, matadors, value, declarerpoints);
            }, 1000);
           app.io.in(room).emit('send stats');
        }
    }

}

function searchJacks(cards) {
    var clear = [];
    if(cards.length > 0) {
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(0) === 'J') {
                clear.push(cards[i]);
            }
        }
    }
    return clear;
}

function orderJacks(cards) {
    var order = [];
    order[0] = 'C';
    order[1] = 'S';
    order[2] = 'H';
    order[3] = 'D';

    var clear = [];
    if(cards.length > 0) {
        for (var i = 0; i < order.length; i++) {
            for (var j = 0; j < cards.length; j++) {
                if (order[i] === cards[j].charAt(1)) {
                    clear.push(cards[j]);
                }
            }
        }
    }
    return clear;
}

function orderdescJacks(cards) {
    var order = [];
    order[0] = 'D';
    order[1] = 'H';
    order[2] = 'S';
    order[3] = 'C';

    var clear = [];
    if(cards.length > 0) {
        for (var i = 0; i < order.length; i++) {
            for (var j = 0; j < cards.length; j++) {
                if (order[i] === cards[j].charAt(1)) {
                    clear.push(cards[j]);
                }
            }
        }
    }
    return clear;
}

function countJacksForBid(cards){
    var order = [];
    order[0] = 'C';
    order[1] = 'S';
    order[2] = 'H';
    order[3] = 'D';
    var jacks = 0;

    if (cards.length > 0) {
        if (cards[0].charAt(1) === 'C') {
            for (var i = 0; i < cards.length; i++){
                if (cards[i].charAt(1) === order[i]) {
                    jacks++;
                } else {
                    i = cards.length;
                }
            }
        } else {
            for (var j = 0; j < cards.length; j++) {
                for (var i = 1; i < order.length; i++) {
                    if (order[i] !== cards[j].charAt(1)) {
                        jacks++;
                        i = j = order.length;
                    }
                }
            }
        }
    } else {
        jacks = 0;
    }
    return jacks;
}

function countJacks(cards) {
    var order = [];
    order[0] = 'C';
    order[1] = 'S';
    order[2] = 'H';
    order[3] = 'D';
    var jacks = 0;

    if (cards.length > 0) {
        if (cards[0].charAt(1) === 'C') {
            for (var i = 0; i < cards.length; i++){
                if (cards[i].charAt(1) === order[i]) {
                    jacks++;
                } else {
                    i = cards.length;
                }
            }
        } else {
            jacks = 1;
            for (var j = 0; j < cards.length; j++) {
                for (var i = 1; i < order.length; i++) {
                    if (order[i] !== cards[j].charAt(1)) {
                        jacks++;
                    }else{
                        i = j = order.length;
                    }
                }
            }
        }
    } else {
        jacks = 4;
    }
    return jacks;
}

function orderByColor(cards, color) {

    var clubs = [];
    var spades = [];
    var hearts = [];
    var diamonds = [];
    if (cards.length > 0) {
        for (var i = 0; i < cards.length; i++) {
            switch ((cards[i]).charAt(1)) {
                case 'C':
                    clubs.push(cards[i]);
                    break;
                case 'S':
                    spades.push(cards[i]);
                    break;
                case 'H':
                    hearts.push(cards[i]);
                    break;
                case 'D':
                    diamonds.push(cards[i]);
                    break;
            }
        }
    }
    switch (color) {
        case 'clubs':
            return clubs;
            break;
        case 'spades':
            return spades;
            break;
        case 'hearts':
            return hearts;
            break;
        case 'diamonds':
            return diamonds;
            break;
    }
}

function countColorTrumps(cards) {
    var order = [];
    order[0] = 'A';
    order[1] = 'T';
    order[2] = 'K';
    order[3] = 'Q';
    order[4] = '9';
    order[5] = '8';
    order[6] = '7';

    var color = 0;
    if (cards.length > 0) {
        if (cards[0].charAt(0) === 'A') {
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].charAt(0) === order[i]) {
                    color++;
                } else {
                    i = cards.length;
                }
            }
        } else {
            for (var j = 0; j < cards.length; j++) {
                for (var i = 0; i < order.length; i++) {
                    if (order[i] !== cards[j].charAt(0)) {
                        color++;
                    } else {
                        i = j = order.length;
                    }
                }
            }
        }
    } else {
        color = 7;
}
    return color;
}

function sortColor(cards) {
    var order = [];
    order[0] = 'A';
    order[1] = 'T';
    order[2] = 'K';
    order[3] = 'Q';
    order[4] = '9';
    order[5] = '8';
    order[6] = '7';

    var clear = [];
    if (cards !== undefined && cards.length > 0){
        for (var j = 0; j < order.length; j++) {
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].charAt(0) === order[j]) {
                    clear.push(cards[i]);
                }
            }
        }
    }
    return clear;
}

function getGameType(declarerpoints, enemypoints, enemycards, matadors) {
    var typeofgame = "";
    var won = true;
    if (declarerpoints >= 61 && declarerpoints >= 31) {
        typeofgame = 'Wygrana zwykła';
    } else if (declarerpoints > 89 && enemypoints < 31 && enemycards !== null) {
        typeofgame = "Wygrana z krawcem";
        matadors++;//dodatkowe punkty
    } else if (enemycards === null) {
        typeofgame = "Wygrana na czarno";
        matadors += 2;//dodatkowe punkty
    } else if (declarerpoints >= 31 && declarerpoints <= 60 && enemypoints >= 60 && enemypoints <= 89) {
        typeofgame = "Przegrana zwykła";
        won = false;
    } else if (declarerpoints < 31) {
        typeofgame = "Przegrana z krawcem";
        won = false;
    }

    data = [];
    data[0] = typeofgame;
    data[1] = won;
    data[2] = matadors;
    return data;
}

function countPoints(cards) {
    var points = 0;
    if (cards.length > 0) {
        for (var i = 0; i < cards.length; i++) {
            switch (cards[i].charAt(0)) {
                case 'J':
                    points += 2;
                    break;
                case 'A':
                    points += 11;
                    break;
                case 'T':
                    points += 10;
                    break;
                case 'K':
                    points += 4;
                    break;
                case 'Q':
                    points += 3;
                    break;
            }
        }
    }
    return points;
}

function countExtraPoints(extra) {
    switch (extra) {
        case 'schneider':
            return 1;
            break;
        case 'schwarz':
            return 2;
            break;
        case 'ouvert':
            return 3;
            break;
    }
}

function countGameValue(declared, matadors) {
    var value = 0;
    if(declared !== null) {
        switch (declared.trim()) {
            case 'clubs':
                value = matadors * 12;
                break;
            case 'spades':
                value = matadors * 11;
                break;
            case 'hearts':
                value = matadors * 10;
                break;
            case 'diamonds':
                value = matadors * 9;
                break;
            case 'grand':
                value = matadors * 24;
                break;
        }
    }
    return value;
}

function getGameObj(room) {
    var obj;
    for (var i = 0; i < GameList.length; i++) {
        obj = GameList[i];
        if (obj.room === room) break;
    }
    return obj;
}

function getDeclarationObj(room) {
    var obj;
    for (var i = 0; i < DeclarationList.length; i++) {
        obj = DeclarationList[i];
        if (obj.room === room) break;
    }
    return obj;
}

function getBidObj(room) {
    var obj;
    for (var i = 0; i < BidList.length; i++) {
        obj = BidList[i];
        if (obj.room === room) break;
    }
    return obj;
}

function getRoomObj(room) {
    var obj;
    for (var i = 0; i < RoomList.length; i++) {
        obj = RoomList[i];
        if (obj.number === parseInt(room)) break;
    }
    return obj;
}

function getComputerObj(room) {
    var obj;
    for (var i = 0; i < ComputerList.length; i++) {
        obj = ComputerList[i];
        if (obj.room === room) break;
    }
    return obj;
}

function deleteChosenCard(cards, card){
    var newcards = [];
    for(var i=0;i<cards.length;i++){
        if(cards[i] !== card){
            newcards.push(cards[i]);
        }
    }
   return newcards;
}

function getComputerHand(incCards, room){
    var cards = [];
    var jacks = [];
    var howmanyjacks = -1;
    var clubs = [];
    var spades = [];
    var hearts = [];
    var diamonds = [];
    var aces = -1;
    var tens = -1;
    var kings = -1;
    var queens = -1;
    var jqk = -1;
    var atk = -1;
    var at = -1;
    var matadors = -1;
    var objComputer = getComputerObj(room);

    for(var i=0;i<incCards.length;i++){
        cards.push(incCards[i].substr(incCards[i].indexOf("id")+3,2));
    }
    jacks  = searchJacks(cards);
    jacks = orderJacks(jacks);
    howmanyjacks = countJacksForBid(jacks);

    clubs = orderByColor(cards, 'clubs');
    spades = orderByColor(cards, 'spades');
    hearts = orderByColor(cards, 'hearts');
    diamonds = orderByColor(cards, 'diamonds');

    var length = [];
    length[0] = clubs.length;
    length[1] = spades.length;
    length[2] = hearts.length;
    length[3] = diamonds.length;

    aces = searchPicture(cards, 'A');
    kings = searchPicture(cards, 'K');
    queens = searchPicture(cards, 'Q');

    jqk = howmanyjacks+kings+queens;
    atk = aces+kings;
    atk += searchPicture(cards, 'T');
    at = aces+searchPicture(cards, 'T');
    //null
    if(aces === 0 && kings === 0 && queens === 0 && howmanyjacks <= 1) {
        //tu deklaracja nulla ouvert
        objComputer.bid = 59;
        objComputer.basic = 'null ouvert';
        objComputer.play = 'declarer';
        objComputer.pickskat= 'no';

    }else if(aces === 0 && kings === 0 && queens <= 1){
        //tu deklaracja nulla
        objComputer.bid = 35;
        objComputer.basic = 'null';
        objComputer.play = 'declarer';
        objComputer.pickskat = 'no';

    }else if(aces === 0 && jqk <= 3){
        objComputer.bid = 23;
        objComputer.basic = 'null';
        objComputer.play = 'declarer';
        objComputer.pickskat = 'yes';
    }else if(howmanyjacks >= 2 && atk >=5){
        //tu deklarujemy gre grand
        matadors = countJacksForBid(jacks);
        objComputer.bid = matadors * 24;
        objComputer.basic = 'grand';
        objComputer.play = 'declarer';
        objComputer.pickskat = 'no';
    }else if(howmanyjacks === 4 && aces >=2){
        matadors = countJacksForBid(jacks);
        objComputer.bid = matadors * 24;
        objComputer.basic = 'grand';
        objComputer.extra = 'ouvert';
        objComputer.play = 'declarer';
        objComputer.pickskat = 'no';
    }else if(howmanyjacks >=2 && atk <=4 ){
        matadors = countJacksForBid(jacks);
        objComputer.bid = matadors * 24;
        objComputer.basic = 'grand';
        objComputer.play = 'declarer';
        objComputer.pickskat = 'yes';
    }else if(howmanyjacks >=2 && aces >=1){
        if(clubs.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(clubs));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(clubs));
            }
            objComputer.bid = matadors * 12;
            objComputer.basic = 'clubs';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }else if(spades.length >= 4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(spades));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(spades));
            }
            objComputer.bid = matadors * 11;
            objComputer.basic = 'spades';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }else if(hearts.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(hearts));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(hearts));
            }
            objComputer.bid = matadors * 10;
            objComputer.basic = 'hearts';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }else if(diamonds.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(diamonds));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(diamonds));
            }
            objComputer.bid = matadors * 9;
            objComputer.basic = 'diamonds';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }
    }else if(howmanyjacks >=2 && atk >=3){
        if(clubs.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(clubs));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(clubs));
            }
            objComputer.bid = matadors * 12;
            objComputer.basic = 'clubs';
            objComputer.play = 'declarer';
            objComputer.extra = 'ouvert';
            objComputer.pickskat = 'no';
        }else if(spades.length >= 4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(spades));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(spades));
            }
            objComputer.bid = matadors * 11;
            objComputer.basic = 'spades';
            objComputer.play = 'declarer';
            objComputer.extra = 'ouvert';
            objComputer.pickskat = 'no';
        }else if(hearts.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(hearts));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(hearts));
            }
            objComputer.bid = matadors * 10;
            objComputer.basic = 'hearts';
            objComputer.extra = 'ouvert';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }else if(diamonds.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(diamonds));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(diamonds));
            }
            objComputer.bid = matadors * 9;
            objComputer.basic = 'diamonds';
            objComputer.extra = 'ouvert';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'no';
        }
    }else if(howmanyjacks >=1 && at > 3){
        if(clubs.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(clubs));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(clubs));
            }
            objComputer.bid = matadors * 12;
            objComputer.basic = 'clubs';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'yes';
        }else if(spades.length >= 4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(spades));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(spades));
            }
            objComputer.bid = matadors * 11;
            objComputer.basic = 'spades';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'yes';
        }else if(hearts.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(hearts));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(hearts));
            }
            objComputer.bid = matadors * 10;
            objComputer.basic = 'hearts';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'yes';
        }else if(diamonds.length >=4){
            matadors = countJacksForBid(jacks);
            if(jacks.length !== 0){
                if(jacks[0].charAt(1) === 'C'){
                    matadors += countColorTrumps(sortColor(diamonds));
                }
            }else if(matadors === 4){
                matadors += countColorTrumps(sortColor(diamonds));
            }
            objComputer.bid = matadors * 9;
            objComputer.basic = 'diamonds';
            objComputer.play = 'declarer';
            objComputer.pickskat = 'yes';
        }
    }
}

function searchPicture(cards, picture){
    var howmany = 0;
    for(var i=0;i<cards.length;i++){
        if(cards[i].charAt(0) === picture){
            howmany++;
        }
    }
    return howmany;
}

function getBidPosition(value) {
    for (var i = 0; i < bidvalues.length; i++) {
        if (value === bidvalues[i]) break;
    }
    return i;
}

function createBidValues() {
    bidvalues = [];
//Kolor
for (var type = 9; type <= 12; type++) {
    for (var matador = 1; matador <= 11; matador++) {
        for (var extrapoint = 0; extrapoint <= 6; extrapoint++) {
            bidvalues.push(type * (1 + matador + extrapoint));
        }
    }
}

//Grand
for (type = 24; type <= 24; type++) {
    for (var matador = 1; matador <= 4; matador++) {
        for (var extrapoint = 0; extrapoint <= 6; extrapoint++) {
            bidvalues.push(type * (1 + matador + extrapoint));
        }
    }
}

//Null
bidvalues.push(23);
bidvalues.push(35);
bidvalues.push(46);
bidvalues.push(59);
}

function sortBidValues() {
    var swapped;
    do {
        swapped = false;
        for (var i = 0; i < bidvalues.length - 1; i++) {
            if (bidvalues[i] > bidvalues[i + 1]) {
                var temp = bidvalues[i];
                bidvalues[i] = bidvalues[i + 1];
                bidvalues[i + 1] = temp;
                swapped = true;
            }
        }
    } while (swapped);
}


function removeDuplicates(num) {
    var x,
        len = num.length,
        out = [],
        obj = {};

    for (x = 0; x < len; x++) {
        obj[num[x]] = 0;
    }
    for (x in obj) {
        out.push(x);
    }
    return out;
}


// GRA Z KOMPUTEREM


function computerDeleteCard(objCards, objComputer, card){
    switch('komputer'){
        case objCards.player1login.trim() :
            objCards.player1 = deleteChosenCard(objCards.player1, card);
            objCards.firstmiddle = card;
            break;
        case objCards.player2login.trim() :
            objCards.player2 = deleteChosenCard(objCards.player2, card);
            objCards.secondmiddle = card;
            break;
        case objCards.player3login.trim() :
            objCards.player3 = deleteChosenCard(objCards.player3, card);
            objCards.thirdmiddle = card;
            break;
    }
    objComputer.cards = deleteChosenCard(objComputer.cards, card);
}

function computerMove(room) {
    var objGame = getGameObj(room);
    var objCards = getCardsObj(room);
    var objComputer = getComputerObj(room);
    var objDeclaration = getDeclarationObj(room);
    var checkWhichIAm = 0;
    var card = '';

    if (objComputer.cards.length > 0) {
        //sprawdzenie który w kolejności wyjeżdzam
        if (objGame.firstturn === null) {
            card = firstMove(room);
            //Przesyłanie karty, którą wybrał komputer innym graczom oraz usuniecie jej z mozliwych kart
            computerDeleteCard(objCards, objComputer, card);
            app.io.in(room).emit('send card', card, 'komputer');
            app.io.in(room).emit('hide card', card, 'komputer');
            if (objComputer.cards.length === 0) {
                var people = objGame.zerocards;
                if (people === null) {
                    var temp = [];
                    temp[0] = 'komputer';
                    objGame.zerocards = temp;
                } else {
                    people.push('komputer');
                    objGame.zerocards = people;
                    if (people.length === 3) {
                        checkWhoWin(room);
                    }
                }
            }
            objGame.turn = getTurn(objGame.turn);
            app.io.in(room).emit('turn', objGame.turn);
        } else {
            //sprawdzenie pozycji
            if (objCards.firstmiddle !== null) checkWhichIAm++;
            if (objCards.secondmiddle !== null) checkWhichIAm++;
            if (objCards.thirdmiddle !== null) checkWhichIAm++;
            switch (checkWhichIAm) {
                case 1:
                    card = secondMove(room);
                    //Przesyłanie karty, którą wybrał komputer innym graczom oraz usuniecie jej z mozliwych kart
                    computerDeleteCard(objCards, objComputer, card);
                    app.io.in(room).emit('send card', card, 'komputer');
                    app.io.in(room).emit('hide card', card, 'komputer');
                    if (objComputer.cards.length === 0) {
                        var people = objGame.zerocards;
                        if (people === null) {
                            var temp = [];
                            temp[0] = 'komputer';
                            objGame.zerocards = temp;
                        } else {
                            people.push('komputer');
                            objGame.zerocards = people;
                            if (people.length === 3) {
                                checkWhoWin(room);
                            }
                        }
                    }
                    objGame.turn = getTurn(objGame.turn);
                    app.io.in(room).emit('turn', objGame.turn);
                    break;
                case 2:
                    card = thirdMove(room);
                    //Przesyłanie karty, którą wybrał komputer innym graczom oraz usuniecie jej z mozliwych kart
                    computerDeleteCard(objCards, objComputer, card);
                    app.io.in(room).emit('send card', card, 'komputer');
                    app.io.in(room).emit('hide card', card, 'komputer');
                    switch (objDeclaration.basic.trim()) {
                        case 'clubs' :
                            checkColorTurnEnd(objGame, objCards, room);
                            break;
                        case 'spades' :
                            checkColorTurnEnd(objGame, objCards, room);
                            break;
                        case 'hearts' :
                            checkColorTurnEnd(objGame, objCards, room);
                            break;
                        case 'diamonds' :
                            checkColorTurnEnd(objGame, objCards, room);
                            break;
                        case 'grand' :
                            checkGrandTurnEnd(objGame, objCards, room);
                            break;
                        case 'null' :
                            checkNullTurnEnd(objGame, objCards, room);
                            break;
                        case 'null ouvert' :
                            checkNullTurnEnd(objGame, objCards, room);
                            break;
                    }

                    if (objComputer.cards.length === 0) {
                        var people = objGame.zerocards;
                        if (people === null) {
                            var temp = [];
                            temp[0] = 'komputer';
                            objGame.zerocards = temp;
                        } else {
                            people.push('komputer');
                            objGame.zerocards = people;
                            if (people.length === 3) {
                                checkWhoWin(room);
                            }
                        }
                    }
                    break;
            }
        }
    }
}

function checkColorTurnEnd(objGame, objCards, room){
        var cards = [];
        var results = [];
        var jacks = [];
        var objDeclaration = getDeclarationObj(room);
        var objComputer = getComputerObj(room);
        var objBid = getBidObj(room);
        var declaredcolor = [];
        var color = '';

    cards.push(objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2));

        var matchColors = [];
        matchColors[0] = 'C';
        matchColors[1] = 'S';
        matchColors[2] = 'H';
        matchColors[3] = 'D';

        var figures = [];
        figures[0] = "A";
        figures[1] = "T";
        figures[2] = "K";
        figures[3] = "Q";
        figures[4] = "9";
        figures[5] = "8";
        figures[6] = "7";

     switch(objDeclaration.basic.trim()){
         case 'clubs': color = 'C'; break;
         case 'spades': color = 'S'; break;
         case 'hearts': color = 'H'; break;
         case 'diamonds': color = 'D'; break;
     }

        for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(0) === 'J') jacks.push(cards[i]);
        }

        if (jacks.length > 0) {
            //Układamy walety kolorem
            for (var j = 0; j < matchColors.length; j++) {
                for (var i = 0; i < jacks.length; i++) {
                    if (jacks[i].charAt(1) === matchColors[j]) results.push(jacks[i]);
                }
            }
        } else if (jacks.length === 0) {//Poziom 2

            // sprawdzenie kart pod wzgledem koloru zadeklarowanego
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].charAt(1) === color) declaredcolor.push(cards[i]);
            }

            if (declaredcolor.length > 0) {
                //ustawienie kart pod wzgledem figur
                for (var j = 0; j < figures.length; j++) {
                    for (var i = 0; i < declaredcolor.length; i++) {
                        if (declaredcolor[i].charAt(0) === figures[j]) {
                            results.push(declaredcolor[i]);
                        }
                    }
                }
            }

            // Poziom 3
            if (declaredcolor.length === 0) {
                //Pobieramy kolor karty ktora pojawila sie jako 1
                var color = objGame.firstturn.charAt(1);
                var CardsSameColor = 0;
                //Sprawdzamy ile jest kart w tym kolorze
                for (var i = 0; i < cards.length; i++) {
                    if (cards[i].charAt(1) === color) {
                        CardsSameColor++;
                    }
                }
                if (CardsSameColor > 1) { //jezeli wiecej niz 1 to ukladamuy pod wzgledem figur
                    for (var i = 0; i < cards.length; i++) {
                        if (cards[i].charAt(1) === color) {
                            results.push(cards[i]);
                        }
                    }
                    var clear = [];
                    for (var j = 0; j < figures.length; j++) {
                        for (var i = 0; i < results.length; i++) {
                            if (results[i].charAt(0) === figures[j]) {
                                clear.push(results[i]);
                            }
                        }
                    }
                    results = clear;
                } else {// kazda karta innego koloru
                    //bierze ten co wyjechał jako 1
                    results[0] = objGame.firstturn;
                }
            }
        }

        var login = '';
        switch (results[0]){
            case  objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2) :
                login = objCards.player1login.trim();
                break;
            case objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2) :
                login = objCards.player2login.trim();
                break;
            case objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2) :
                login = objCards.player3login.trim();
                break;
        }

        var players = objGame.players;
        var positions = objGame.positions;
        var temp = -1;
        for(var i=0;i<players.length;i++){
            if(players[i].trim() === login.trim()){
                temp = i;
                i = players.length;
            }
        }

        var turn = '';
    turn = positions[temp];

        if (objBid.bidwinner.trim() !== login.trim()){
            var temp = objGame.oppcards;
            if (temp === null) {
                temp = cards
            } else {
                for (var i = 0; i < cards.length; i++) {
                    temp.push(cards[i]);
                }
            }
            objGame.oppcards = temp;
            var objDeclaration = getDeclarationObj(room);
            if(objDeclaration.extra !== null && objDeclaration.extra.trim() === 'ouvert'){
                var objBid = getBidObj(room);
                var points = 0;
                var decpoints = parseInt(objBid.bidvalue);
               points = -2*decpoints;
                var result = 'Przegrał grę';
                setTimeout(function(){
                    app.io.in(room).emit('game result', objBid.bidwinner, objBid.bidvalue, result, '0', '0', points);
                }, 1000);
                app.io.in(room).emit('update status', 'przegrana');
                app.io.in(room).emit('send stats');
            }
        }else if (objBid.bidwinner.trim() === login.trim()){
            var objGame = getGameObj(room);
            var temp = objGame.deccards;
            if (temp === null) {
                temp = cards
            } else {
                for (var i = 0; i < cards.length; i++) {
                    temp.push(cards[i]);
                }
            }
            objGame.deccards = temp;
        }
    setTimeout(
        function()
        {
        objCards.firstmiddle = null;
        objCards.secondmiddle = null;
        objCards.thirdmiddle = null;
        objGame.firstturn = null;
        app.io.in(room).emit('clear table');
       objGame.turn = turn;
    if(objComputer !== undefined && objComputer.position.trim() === objGame.turn.trim()){
        computerMove(room);
    }else {
        app.io.in(room).emit('turn', objGame.turn);
    }
     }, 1000);
}

function checkGrandTurnEnd(objGame, objCards, room){
    /*
     Sprawdzenie kto wygrał odbywa się na kilku poziomach.
     1. Sprawdzamy czy są walety
     A. Układamy je według kolejności ten arr[0] wygrywa
     2. Sprawdzamy czy są karty koloru niezadeklarowanego
     A. Jeżeli są to układamy je według kolejnośći(kolory, figury) karta arr[0] wygrywa
     B. Jeżeli każda karta jest innego koloru(niezadeklarowanego) wygrywa karta gracza, który wychodził jako pierwszy do lewy.
     */


        var cards = [];
        var results = [];
        var jacks = [];
        var objComputer = getComputerObj(room);


    cards.push(objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2));


        var figures = [];
        figures[0] = "A";
        figures[1] = "T";
        figures[2] = "K";
        figures[3] = "Q";
        figures[4] = "9";
        figures[5] = "8";
        figures[6] = "7";

    var matchColors = [];
    matchColors[0] = 'C';
    matchColors[1] = 'S';
    matchColors[2] = 'H';
    matchColors[3] = 'D';


        for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(0) === 'J') jacks.push(cards[i]);
        }

        if (jacks.length > 0) {
            //Układamy walety kolorem
            for (var j = 0; j < matchColors.length; j++) {
                for (var i = 0; i < jacks.length; i++) {
                    if (jacks[i].charAt(1) === matchColors[j]) results.push(jacks[i]);
                }
            }
        } else if (jacks.length === 0) {//Poziom 2

            //Pobieramy kolor karty ktora pojawila sie jako 1
            var color = objGame.firstturn.charAt(1);
            var CardsSameColor = 0;
            //Sprawdzamy ile jest kart w tym kolorze
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].charAt(1) === color) {
                    CardsSameColor++;
                }
            }
            if (CardsSameColor > 1) { //jezeli wiecej niz 1 to ukladamy pod wzgledem figur
                for (var i = 0; i < cards.length; i++) {
                    if (cards[i].charAt(1) === color) {
                        results.push(cards[i]);
                    }
                }
                var clear = [];
                for (var j = 0; j < figures.length; j++) {
                    for (var i = 0; i < results.length; i++) {
                        if (results[i].charAt(0) === figures[j]) {
                            clear.push(results[i]);
                        }
                    }
                }
                results = clear;
            } else {// kazda karta innego koloru
                //bierze ten co wyjechał jako 1
                results[0] = objGame.firstturn;
            }
        }

    var login = '';
    switch (results[0]){
        case  objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2) :
            login = objCards.player1login.trim();
            break;
        case objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2) :
            login = objCards.player2login.trim();
            break;
        case objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2) :
            login = objCards.player3login.trim();
            break;
    }

    var players = objGame.players;
    var positions = objGame.positions;
    var temp = -1;
    for(var i=0;i<players.length;i++){
        if(players[i].trim() === login.trim()){
            temp = i;
            i = players.length;
        }
    }

    var turn = '';
    turn = positions[temp];
   var objBid = getBidObj(room);

    if (objBid.bidwinner.trim() !== login.trim()){
        var temp = objGame.oppcards;
        if (temp === null) {
            temp = cards
        } else {
            for (var i = 0; i < cards.length; i++) {
                temp.push(cards[i]);
            }
        }
        objGame.oppcards = temp;
        var objDeclaration = getDeclarationObj(room);
        if(objDeclaration.extra !== null && objDeclaration.extra.trim() === 'ouvert') {
            var objBid = getBidObj(room);
            var points = 0;
            var decpoints = parseInt(objBid.bidvalue);
            points = -2 * decpoints;
            var result = 'Przegrał grę';
            setTimeout(function () {
                app.io.in(room).emit('game result', objBid.bidwinner, objBid.bidvalue, result, '0', '0', points);
            }, 1000);
            app.io.in(room).emit('update status', 'przegrana');
            app.io.in(room).emit('send stats');
        }
    }else if (objBid.bidwinner.trim() === login.trim()){
        var objGame = getGameObj(room);
        var temp = objGame.deccards;
        if (temp === null) {
            temp = cards
        } else {
            for (var i = 0; i < cards.length; i++) {
                temp.push(cards[i]);
            }
        }
        objGame.deccards = temp;
    }

    setTimeout(
        function()
        {
    objCards.firstmiddle = null;
    objCards.secondmiddle = null;
    objCards.thirdmiddle = null;
    objGame.firstturn = null;
    app.io.in(room).emit('clear table');
    objGame.turn = turn;
    if(objComputer !== undefined && objComputer.position.trim() === objGame.turn.trim()){
        computerMove(room);
    }else {
        app.io.in(room).emit('turn', objGame.turn);
    }
        }, 1000);
}

function checkNullTurnEnd(objGame, objCards, room){
    /*
     Sprawdzenie kto wygrał odbywa się na kilku poziomach.
     1. Sprawdzamy ile jest kart w kolorze
     A. Układamy je według kolejności ten arr[0] wygrywa
     2. Inaczej każda karta jest innego koloru(niezadeklarowanego) wygrywa karta gracza, który wychodził jako pierwszy do lewy.
     */

    var color = objGame.firstturn.charAt(1);
    var CardsSameColor = 0;
    var results = [];
    var cards = [];
    var objBid = getBidObj(room);
    var objDeclaration = getDeclarationObj(room);
    var objComputer = getComputerObj(room);

    cards.push(objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2));
    cards.push(objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2));


        var figures = [];
        figures[0] = 'A';
        figures[1] = 'K';
        figures[2] = 'Q';
        figures[3] = 'J';
        figures[4] = 'T';
        figures[5] = '9';
        figures[6] = '8';
        figures[7] = '7';


        //Sprawdzamy ile jest kart w tym kolorze
        for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(1) === color) {
                CardsSameColor++;
            }
        }
        if (CardsSameColor > 1) { //jezeli wiecej niz 1 to ukladamy pod wzgledem figur
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].charAt(1) === color) {
                    results.push(cards[i]);
                }
            }
            var clear = [];
            for (var j = 0; j < figures.length; j++) {
                for (var i = 0; i < results.length; i++) {
                    if (results[i].charAt(0) === figures[j]) {
                        clear.push(results[i]);
                    }
                }
            }
            results = clear;
        } else {// kazda karta innego koloru
            //bierze ten co wyjechał jako 1
            results[0] = objGame.firstturn;
        }

    var login = '';
    switch (results[0]){
        case  objCards.firstmiddle.substr(objCards.firstmiddle.indexOf("id") + 3, 2) :
            login = objCards.player1login.trim();
            break;
        case objCards.secondmiddle.substr(objCards.secondmiddle.indexOf("id") + 3, 2) :
            login = objCards.player2login.trim();
            break;
        case objCards.thirdmiddle.substr(objCards.thirdmiddle.indexOf("id") + 3, 2) :
            login = objCards.player3login.trim();
            break;
    }

    var players = objGame.players;
    var positions = objGame.positions;
    var temp = -1;
    for(var i=0;i<players.length;i++){
        if(players[i].trim() === login.trim()){
            temp = i;
            i = players.length;
        }
    }

    var turn = '';
    turn = positions[temp];
    if (objBid.bidwinner.trim() === login.trim()) {
        // 1. Zakńczenie gry null - przegraną dla deklarującego grę.
        var points = 0;

        switch(objDeclaration.basic.trim()){
            case 'null':
                if(objDeclaration.pickskat.trim() === 'yes') points = -46;
                if(objDeclaration.pickskat.trim() === 'no') points = -70;
                break;
            case 'null ouvert':
                if(objDeclaration.pickskat.trim() === 'yes') points = -92;
                if(objDeclaration.pickskat.trim() === 'no') points = -118;
                break;
        }
        var result = 'Przegrał grę '+objDeclaration.basic;
        setTimeout(function() {
        app.io.in(room).emit('game result', objBid.bidwinner, '0', result, '0', '0', points);
            }, 1000);
        app.io.in(room).emit('update status', 'przegrana');
        app.io.in(room).emit('send stats');
        } else {
        setTimeout(
            function()
            {
        objCards.firstmiddle = null;
        objCards.secondmiddle = null;
        objCards.thirdmiddle = null;
        objGame.firstturn = null;
        app.io.in(room).emit('clear table');

        objGame.turn = turn;
        if(objComputer !== undefined && objGame.turn.trim() === objComputer.position.trim()){
            computerMove(room);
        }else {
            app.io.in(room).emit('turn', objGame.turn);
        }
            }, 1000);
        }
}


function thirdMove(room){
    var objDeclaration = getDeclarationObj(room);
    var objComputer = getComputerObj(room);
    var cards = objComputer.cards;
    //zamiana kart tylko na ich id
    var idcards = [];
    var card = '';

    for(var i=0;i<cards.length;i++){
        idcards.push(cards[i].substr(cards[i].indexOf("id")+3,2));
    }

    switch(objDeclaration.basic.trim()) {
        case 'clubs' :
            card = getComputerCardColorThirdMove(idcards, 'C',room);
            break;
        case 'spades' :
            card = getComputerCardColorThirdMove(idcards, 'S',room);
            break;
        case 'hearts' :
            card = getComputerCardColorThirdMove(idcards, 'H',room);
            break;
        case 'diamonds' :
            card = getComputerCardColorThirdMove(idcards, 'D',room);
            break;
        case 'grand' :
            card = getComputerCardGrandThirdMove(idcards, room);
            break;
        case 'null' :
            card = getComputerCardNullNullOuvertSecondThirdMove(idcards,room);
            break;
        case 'null ouvert' :
            card = getComputerCardNullNullOuvertSecondThirdMove(idcards,room);
            break;
    }



    //zamiana z postaci id -> kartę
    for(var i=0;i<cards.length;i++){
        if(cards[i].substr(cards[i].indexOf("id")+3,2) === card){
            card = cards[i];
        }
    }
    return card;
}

function getComputerCardGrandThirdMove(cards, room){
    var objGame = getGameObj(room);
    var card = '';
    var getColor = false;
    var EnemyCard = '';
    var FriendCard = '';
    var objCard = getCardsObj(room);
    var objBid = getBidObj(room);


    if (objBid.bidwinner.trim() === 'komputer') {
        //1 karta na pewno należy do wroga komputer jako solista nie ma przyjaciół
        var arr = [];
        arr[0] = objCard.firstmiddle;
        arr[1] = objCard.secondmiddle;
        arr[2] = objCard.thirdmiddle;
        var secondEnemyCard = '';
        //firstEnemyCard to objGame.firstturn;
        for(var i=0;i<arr.length;i++){
            if(arr[i]!== null){
                if(arr[i].substr(arr[i].indexOf("id") + 3, 2) !== objGame.firstturn){
                    secondEnemyCard = arr[i].substr(arr[i].indexOf("id") + 3, 2);
                    i = arr.length;
                }
            }
        }

        //sprawdzenie cyz pierwsza karta to J
        if (objGame.firstturn.charAt(0) === 'J') {
            var Jacks = searchJacks(cards);

            if (Jacks.length > 0) {
                var myIsHigher = false;
                myIsHigher = checkIFCanBeatJack(objGame.firstturn.charAt(1), Jacks);

                if (myIsHigher === false) {
                    card = getLowestJack(Jacks);
                }else{
                    //moge przebic J 1 wroga teraz sprawdzam cyz moge przebic J 2 wroga
                    if(secondEnemyCard.charAt(0) === 'J'){
                        var myIsHigherAgain = false;
                        myIsHigherAgain = checkIFCanBeatJack(secondEnemyCard.charAt(1), Jacks);
                        if(myIsHigherAgain === false){
                            card = getLowestJack(Jacks);
                        }else{
                            card = getHighestJack(Jacks);
                        }
                    }else{
                        card = getHighestJack(Jacks);
                    }
                }
            } else {
                    card = getLowestCard(cards);
            }
            }else{
             var CardColor = objGame.firstturn.charAt(1);
            var GotColor = checkIFGotDecColor(cards, CardColor);
            if(GotColor === false){
                if(secondEnemyCard.charAt(0) === 'J'){
                    var Jacks = searchJacks(cards);
                    if(Jacks.length > 0){
                        var myIsHigher = false;
                        myIsHigher = checkIFCanBeatJack(secondEnemyCard, Jacks);
                        if(myIsHigher === false){
                            card = getLowestCard(cards);
                        }else{
                            card = getHighestCard(cards);
                        }
                    }else{
                        card = getLowestCard(cards);
                    }
                }else{
                    var Jacks = searchJacks(cards);
                    if(Jacks.length > 0){
                        card = getLowestJack(Jacks);
                    }else{
                        card = getLowestCard(cards);
                    }
                }
            }else{
                if(secondEnemyCard.charAt(0) === 'J'){
                    card = getLowestColorCard(cards, CardColor);
                }else if(secondEnemyCard.charAt(1) === CardColor){
                    var myPos = -1;
                    var EnemyOnePos = -1;
                    var EnemyTwoPos = -1;
                    var myTempCard = getHighestColorCard(cards, CardColor);
                    var figures = [];
                    figures[0] = 'A';
                    figures[1] = 'T';
                    figures[2] = 'K';
                    figures[3] = 'Q';
                    figures[4] = '9';
                    figures[5] = '8';
                    figures[6] = '7';
                    for (var i = 0; i < figures.length; i++) {
                        if (figures[i] === objGame.firstturn.charAt(0)) {
                            EnemyOnePos = i;
                        } else if (figures[i] === secondEnemyCard.charAt(0)) {
                            EnemyTwoPos = i;
                        } else if (figures[i] === myTempCard.charAt(0)) {
                            myPos = i;
                        }
                    }

                    if (myPos > EnemyOnePos && myPos > EnemyTwoPos) {
                        card = myTempCard;
                    } else {
                        card = getLowestColorCard(cards, CardColor);
                    }
                }else{
                    var myIsHigher = false;
                    myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), CardColor);
                    if(myIsHigher === false){
                        card = getLowestColorCard(cards, CardColor);
                    }else{
                        card = getHighestColorCard(cards, CardColor);
                    }
                }
            }
                }
        }else {
        //sprawdzamy która karta nalezy do przyjaciela a która do wroga
        var arr = [];
        arr[0] = objCard.firstmiddle;
        arr[1] = objCard.player1login.trim();
        arr[2] = objCard.secondmiddle;
        arr[3] = objCard.player2login.trim();
        arr[4] = objCard.thirdmiddle;
        arr[5] = objCard.player3login.trim();

        for (var i = 0; i < arr.length; i += 2) {
            if (arr[i] !== null) {
                if (objBid.bidwinner.trim() === arr[i + 1].trim()) {
                    EnemyCard = arr[i];
                } else {
                    FriendCard = arr[i];
                }
            }
        }

        EnemyCard = EnemyCard.substr(EnemyCard.indexOf("id") + 3, 2);
        FriendCard = FriendCard.substr(FriendCard.indexOf("id") + 3, 2);

        //sprawdzamy czy to J

        if (objGame.firstturn.charAt(0) === 'J') {
            var Jacks = searchJacks(cards);
            //sprawdzamy czy mamy J
            if (Jacks.length > 0) {
                //sprawdzamy do kogo nalezy karta do wroga czy przyjaciela
                if (IfEnemyCard(room) === true) {
                    //karta wroga
                    //sprawdzam czy moge przebic tego J
                    var myIsHigher = false;
                    myIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);

                    if (myIsHigher === false) {
                        // nie mogę przebić tego J
                        card = getLowestJack(Jacks);
                    } else {
                        card = getHighestJack(Jacks);
                    }
                } else {
                    //karta nalezy do przyjaciela
                    // wyjzedzam najwiekszym J
                    card = getLowestJack(Jacks);
                }
            } else {
                //nie mam J
                //sprawdzam do kogo nalezy karta
                if (IfEnemyCard(room) === true) {
                    //karta nalezy do wroga
                    //sprawdzam czy przyjaciel może przebić kartę wroga
                    if (FriendCard.charAt(0) === 'J') {
                           var myFriendIsHigher = false;
                        myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard,EnemyCard);
                        if(myFriendIsHigher === false){
                            card = getLowestCard(cards);
                        }else{
                            card = getHighestCard(cards);
                        }
                    } else {
                        //inaczej jedz najmniejszym - przyjaciel jak nie ma J to nie przebije J niczym innym a ty tez nie
                        card = getLowestCard(cards);
                    }
                } else {
                    //karta nalezy do przyjaciela
                    //sprawdzam czy wróg może ją przebić

                    if (EnemyCard.charAt(0) === 'J') {
                        var myFriendIsHigher = false;
                        myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard,EnemyCard);
                        if(myFriendIsHigher === false){
                            card = getLowestCard(cards);
                        }else{
                            card = getHighestCard(cards);
                        }
                    } else {
                        //inaczej jedz najwieksza
                        card = getHighestCard(cards);
                    }
                }
            }
        } else {
            //sprawdz czy masz kartę w kolorze pierwszej karty
            //sprzawdzamy czy masz kartę kolorze pierwszej karty
            var getColor = false;
            getColor = checkIFGotDecColor(cards, objGame.firstturn.charAt(1));
            if (getColor === true) {
                //mam karte w kolorze sprawdzam do kogo nalezy ta karta
                if (IfEnemyCard(room) === true) {
                    //karta nalezy do wroga
                    //sprawdzam czy mogę ją przebić
                    var myIsHigher = false;
                    myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, EnemyCard.charAt(1));
                    if (myIsHigher === false) {
                        //sprawdzam czy przyjaciel może przebić kartę wroga
                        if (FriendCard.charAt(0) === 'J') {
                            //jeżeli przyjaciel wyjechał J a wróg kazdą inną kartą inną niz J przyjaciel wygra
                            card = getHighestColorCard(cards, EnemyCard.charAt(1));
                        } else if (FriendCard.charAt(1) === EnemyCard.charAt(1)) {
                            var friendIsHigher = false;
                            friendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, FriendCard.charAt(1));
                            if (friendIsHigher === false) {
                                card = getLowestColorCard(cards, EnemyCard.charAt(1));
                            } else {
                                card = getHighestColorCard(cards, EnemyCard.charAt(1));
                            }
                        } else {
                            card = getLowestColorCard(cards, EnemyCard.charAt(1));
                        }
                    } else {
                        card = getHighestColorCard(cards, EnemyCard.charAt(1));
                    }
                } else {
                    //karta nalezy do przyjaciela
                    //trzeba sprawdzić czy wróg może przebić kartę przyjaciela
                    if (EnemyCard.charAt(0) === 'J') {
                        card = getLowestColorCard(cards, FriendCard.charAt(1));
                    } else if (EnemyCard.charAt(1) === FriendCard.charAt(1)) {
                        var friendIsHigher = false;
                        friendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, FriendCard.charAt(1));
                        if (friendIsHigher === false) {
                            card = getLowestColorCard(cards, FriendCard.charAt(1));
                        } else {
                            card = getHighestColorCard(cards, FriendCard.charAt(1));
                        }
                    } else {
                        card = getHighestColorCard(cards, FriendCard.charAt(1));
                    }
                }
            } else {
                //nie mam karty w kolorze
                if (IfEnemyCard(room) === true) {
                    //karta nalezy do wroga
                    //trzeba sprawdzic czy mam J
                    var Jacks = searchJacks(cards);
                    if (Jacks.length > 0) {
                        card = getLowestJack(Jacks);
                    } else {
                        //trzeba sprawdzic czy przyjaciel przebije kartę wroga
                        if (FriendCard.charAt(0) === 'J') {
                            card = getHighestCard(cards);
                        } else if (EnemyCard.charAt(1) === FriendCard.charAt(1)) {
                            var friendIsHigher = false;
                            friendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, FriendCard.charAt(1));
                            if (friendIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestCard(cards);
                            }
                        } else {
                            card = getLowestCard(cards);
                        }
                    }
                } else {
                    //karta nalezy do przyjaciela
                    //trzeba sprawdzic czy wróg może ją przebić
                    if (EnemyCard.charAt(0) === 'J') {
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            //sprawdzam czy przebije J wroga
                            var myJIsHigher = false;
                            myJIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);
                            if (myJIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestJack(Jacks);
                            }
                        } else {
                            card = getLowestCard(cards);
                        }
                    } else if (EnemyCard.charAt(1) === FriendCard.charAt(1)) {
                        var friendIsHigher = false;
                        friendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, FriendCard.charAt(1));
                        if (friendIsHigher === false) {
                            card = getLowestCard(cards);
                        } else {
                            card = getHighestCard(cards);
                        }
                    } else {
                        card = getHighestCard(cards);
                    }
                }
            }
        }
    }
    return card;
}

function getLowestCard(cards){
    var card = '';
    var figures = [];
    figures[0] = "7";
    figures[1] = "8";
    figures[2] = "9";
    figures[3] = "Q";
    figures[4] = "K";
    figures[5] = "T";
    figures[6] = "A";

    for(var j=0;j<figures.length;j++){
         for(var i=0;i<cards.length;i++){
            if(cards[i].charAt(0) === figures[j]){
                card = cards[i];
                i = cards.length;
                j = figures.length;
            }
        }
    }

    return card;
}

function getHighestCard(cards){
    var card = '';
    var figures = [];
    figures[0] = "A";
    figures[1] = "T";
    figures[2] = "K";
    figures[3] = "Q";
    figures[4] = "9";
    figures[5] = "8";
    figures[6] = "7";

    for(var j=0;j<figures.length;j++){
         for(var i=0;i<cards.length;i++){
            if(cards[i].charAt(0) === figures[j]){
                card = cards[i];
                i = cards.length;
                j = figures.length;
            }
        }
    }

    return card;
}

function getComputerCardColorThirdMove(cards, color, room) {
    var objGame = getGameObj(room);
    var card = '';
    var objCard = getCardsObj(room);
    var EnemyCard = '';
    var FriendCard = '';
        var objBid = getBidObj(room);

        if (objBid.bidwinner.trim() === 'komputer') {
         //1 karta na pewno należy do wroga komputer jako solista nie ma przyjaciół
        var arr = [];
        arr[0] = objCard.firstmiddle;
        arr[1] = objCard.secondmiddle;
        arr[2] = objCard.thirdmiddle;
        var secondEnemyCard = '';
        //firstEnemyCard to objGame.firstturn;
        for(var i=0;i<arr.length;i++){
            if(arr[i]!== null){
                if(arr[i].substr(arr[i].indexOf("id") + 3, 2) !== objGame.firstturn){
                    secondEnemyCard = arr[i].substr(arr[i].indexOf("id") + 3, 2);
                    i = arr.length;
                }
            }
        }

         //sprawdzenie cyz pierwsza karta to J
        if (objGame.firstturn.charAt(0) === 'J') {
            var Jacks = searchJacks(cards);

            if (Jacks.length > 0) {
                var myIsHigher = false;
                myIsHigher = checkIFCanBeatJack(objGame.firstturn.charAt(1), Jacks);

                if (myIsHigher === false) {
                    card = getLowestJack(Jacks);
                }else{
                    //moge przebic J 1 wroga teraz sprawdzam cyz moge przebic J 2 wroga
                    if(secondEnemyCard.charAt(0) === 'J'){
                        var myIsHigherAgain = false;
                        myIsHigherAgain = checkIFCanBeatJack(secondEnemyCard.charAt(1), Jacks);
                        if(myIsHigherAgain === false){
                            card = getLowestJack(Jacks);
                        }else{
                            card = getHighestJack(Jacks);
                        }
                    }else{
                        card = getHighestJack(Jacks);
                    }
                }
            } else {
                var DecColor = false;
                DecColor = checkIFGotDecColor(cards, color);
                if(DecColor === false){
                    card = getLowestCard(cards);
                }else{
                    card = getLowestColorCard(cards, color);
                }
            }
        }else if(objGame.firstturn.charAt(1) === color){
            var Jacks = searchJacks(cards);
            if (Jacks.length > 0) {
                //w tym miejscu juz wiem ze na pewno przebije karte 1 wroga on pojechal kolorem zadeklarowanym ja pojade J
                //sprawdzam czy przebije tez karte 2 wroga
                if(secondEnemyCard.charAt(0) === 'J') {
                    var myJIsHigher = false;
                    myJIsHigher = checkIFCanBeatJack(secondEnemyCard, Jacks);
                    if (myJIsHigher === false) {
                      card = getLowestJack(Jacks);
                    } else {
                      card = getHighestJack(Jacks);
                    }
                }else{
                    //w tym miejscu wiem ze co to by za karta nie byla przebije tez 2 wroga
                    card = getHighestJack(Jacks);
                }
            }else{
                //najpierw sprawdze co ma 2 wrog i czy moge go przebic a dopiero potem sprawdze 1 wroga
                if(secondEnemyCard.charAt(0) === 'J'){
                    //na pewno nie przebije jade najmniejsza w zadeklarowanym kolorze jezeli go mam a jak nie to najmniejsza
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if(DecColor === false){
                        card = getLowestCard(cards, color);
                    }else{
                        card = getLowestColorCard(cards, color);
                    }
                }else if(secondEnemyCard.charAt(1) === color){
                    //jest szansa ze przebije 2 wrogów ale tylko jezeli mam zadeklarowany kolor
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if(DecColor === false){
                        card = getLowestCard(cards);
                    }else {
                        var myPos = -1;
                        var EnemyOnePos = -1;
                        var EnemyTwoPos = -1;
                        var myTempCard = getHighestColorCard(cards, color);
                        var figures = [];
                        figures[0] = 'A';
                        figures[1] = 'T';
                        figures[2] = 'K';
                        figures[3] = 'Q';
                        figures[4] = '9';
                        figures[5] = '8';
                        figures[6] = '7';
                        for (var i = 0; i < figures.length; i++) {
                            if (figures[i] === objGame.firstturn.charAt(0)) {
                                EnemyOnePos = i;
                            } else if (figures[i] === secondEnemyCard.charAt(0)) {
                                EnemyTwoPos = i;
                            } else if (figures[i] === myTempCard.charAt(0)) {
                                myPos = i;
                            }
                        }

                        if (myPos > EnemyOnePos && myPos > EnemyTwoPos) {
                            card = myTempCard;
                        } else {
                            card = getLowestColorCard(cards, color);
                        }
                    }
                }else{
                    //2 wrog pojechal karta w kolorze niezadeklarowanym wiec wystraczy sprawdzic czy przebije 1 wroga
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if(DecColor === false){
                        card = getLowestCard(cards);
                    }else{
                        var myIsHigher = false;
                        myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), color);
                        if(myIsHigher === false){
                            card = getLowestColorCard(cards, color);
                        }else{
                            card = getHighestColorCard(cards, color);
                        }

                    }
                }
            }
        }else{
            //karta 1 wroga w kolorze niezadeklarowanym
            var CardColor = objGame.firstturn.charAt(1);
            var GotColor = false;
            GotColor = checkIFGotDecColor(cards, CardColor);
            if (GotColor === true) {
               if(secondEnemyCard.charAt(0) === 'J' || secondEnemyCard.charAt(1) === color){
                   card = getLowestColorCard(cards, CardColor);
               }else{
                   if(secondEnemyCard.charAt(1) === CardColor){
                       var myPos = -1;
                       var EnemyOnePos = -1;
                       var EnemyTwoPos = -1;
                       var myTempCard = getHighestColorCard(cards, CardColor);
                       var figures = [];
                       figures[0] = 'A';
                       figures[1] = 'T';
                       figures[2] = 'K';
                       figures[3] = 'Q';
                       figures[4] = '9';
                       figures[5] = '8';
                       figures[6] = '7';
                       for (var i = 0; i < figures.length; i++) {
                           if (figures[i] === objGame.firstturn.charAt(0)) {
                               EnemyOnePos = i;
                           } else if (figures[i] === secondEnemyCard.charAt(0)) {
                               EnemyTwoPos = i;
                           } else if (figures[i] === myTempCard.charAt(0)) {
                               myPos = i;
                           }
                       }
                       if (myPos > EnemyOnePos && myPos > EnemyTwoPos) {
                           card = myTempCard;
                       } else {
                           card = getLowestColorCard(cards, CardColor);
                       }
                   }else{
                       //oznacza to ze tylko 1 karta jest w kolorze niezadeklarowanym i tylka ja musze sprawdzic czy moge przebic
                       var myIsHigher = false;
                       myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), CardColor);
                       if(myIsHigher === false){
                           card = getLowestColorCard(cards, CardColor);
                       }else{
                           card = getHighestColorCard(cards, CardColor);
                       }
                   }
               }
            } else {
              //nie mam zadeklarowanego koloru
                var Jacks = searchJacks(cards);
                var DecColor = false;
                var DecColor = checkIFGotDecColor(cards,color);
                if(Jacks.length > 0){
                    if(secondEnemyCard.charAt(0) === 'J'){
                        var myJIsHigher = false;
                        myJIsHigher = checkIFCanBeatJack(secondEnemyCard, Jacks);
                        if(myJIsHigher === false){
                            card = getLowestCard(cards);
                        }else{
                           card = getHighestJack(Jacks);
                        }
                    }else{
                        card = getLowestJack(Jacks);
                    }
                }else if(DecColor === true){
                    if(secondEnemyCard.charAt(0) === 'J') {
                        card = getLowestCard(cards);
                    }else if(secondEnemyCard.charAt(1) === color){
                        var myIsHigher = false;
                        myIsHigher = checkIfMyCardCanBeatEnemy(cards,secondEnemyCard, color);
                        if(myIsHigher === false){
                           card = getLowestCard(cards);
                        }else{
                            card = getHighestColorCard(cards, color);
                        }
                    }else{
                        card = getHighestColorCard(cards, color);
                    }
                }else{
                    card = getLowestCard(cards);
                }
        }
        }
    } else {
        //sprawdzamy która karta nalezy do przyjaciela a która do wroga
        var arr = [];
        arr[0] = objCard.firstmiddle;
        arr[1] = objCard.player1login.trim();
        arr[2] = objCard.secondmiddle;
        arr[3] = objCard.player2login.trim();
        arr[4] = objCard.thirdmiddle;
        arr[5] = objCard.player3login.trim();

        for (var i = 0; i < arr.length; i += 2) {
            if (arr[i] !== null) {
                if (objBid.bidwinner.trim() === arr[i + 1].trim()) {
                    EnemyCard = arr[i];
                } else {
                    FriendCard = arr[i];
                }
            }
        }
        EnemyCard = EnemyCard.substr(EnemyCard.indexOf("id") + 3, 2);
        FriendCard = FriendCard.substr(FriendCard.indexOf("id") + 3, 2);

        if (IfEnemyCard(room) === true) {
            //1 karta wroga
            if (objGame.firstturn.charAt(0) === 'J') {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    var myIsHigher = false;
                    myIsHigher = checkIFCanBeatJack(EnemyCard.charAt(1), Jacks);
                    if (myIsHigher === false) {
                        card = getLowestJack(Jacks);
                    } else {
                        //moge przebić szukam najwyzszego J
                        card = getHighestJack(Jacks);
                    }
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        //sprawdzam czy przyjaciel moze przebic karte wroga
                        //a przebije ją tylko inny wyższy J
                        // ja na pewno nie moge bo nie mam J a pojechal J
                        if (FriendCard.charAt(0) === 'J') {
                            var myFriendIsHigher = false;
                            myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard, EnemyCard);
                            if (myFriendIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestCard(cards);
                            }
                        } else {
                            //przyjaciel nie ma szans przebic karty wroga
                            card = getLowestCard(cards);
                        }
                    } else {
                        //sprawdzam czy przyjaciel moze przebic karte wroga
                        //a przebije ją tylko inny wyższy J
                        // ja na pewno nie moge bo nie mam J a pojechal J
                        if (FriendCard.charAt(0) === 'J') {
                            var myFriendIsHigher = false;
                            myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard, EnemyCard);
                            if (myFriendIsHigher === false) {
                                card = getLowestColorCard(cards, color);
                            } else {
                                card = getHighestColorCard(cards, color);
                            }
                        } else {
                            //przyjaciel nie ma szans przebic karty wroga
                            card = getLowestColorCard(cards, color);
                        }
                    }
                }
            } else if (objGame.firstturn.charAt(1) === color) {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    card = getLowestJack(Jacks);
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        //sprawdzam czy przyjaciel moze przebic ja nie moge
                        if (FriendCard.charAt(0) === 'J') {
                            card = getHighestCard(cards);
                        } else if (FriendCard.charAt(1) === color) {
                            var myFriendIsHigher = false;
                            myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, color);
                            if (myFriendIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestCard(cards);
                            }
                        } else {
                            card = getLowestCard(cards);
                        }
                    } else {
                        //sprawdzam czy moge przebic karte wroga
                        var myIsHigher = false;
                        myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, color);
                        if (myIsHigher === false) {
                            //sprawdzam czy przyjaciel moze przebic
                            if (FriendCard.charAt(0) === 'J') {
                                card = getHighestColorCard(cards, color);
                            } else if (FriendCard.charAt(1) === color) {
                                var myFriendIsHigher = false;
                                myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, color);
                                if (myFriendIsHigher === false) {
                                    card = getLowestColorCard(cards, color);
                                } else {
                                    card = getHighestColorCard(cards, color);
                                }
                            } else {
                                card = getLowestColorCard(cards, color);
                            }
                        } else {
                            card = getHighestColorCard(cards, color);
                        }
                    }
                }
            } else {
                //wrog pojechal karta koloru niezadekalrowanego
                var CardColor = objGame.firstturn.charAt(1);
               var GotColor = false;
                GotColor = checkIFGotDecColor(cards, CardColor);
                if(GotColor === true){
                    var myIsHigher = false;
                    myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, CardColor);
                    if(myIsHigher === false){
                        //sprawdzmy czy przyjaciel może przebić
                        if(FriendCard.charAt(0) === 'J'){
                           card = getHighestColorCard(cards, CardColor);
                        }else if(FriendCard.charAt(1) === color){
                            card = getHighestColorCard(cards, CardColor);
                        }else if(FriendCard.charAt(1) === CardColor) {
                            var myFriendIsHigher = false;
                            myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, CardColor);
                            if (myFriendIsHigher === false) {
                                card = getLowestColorCard(cards, CardColor);
                            } else {
                                card = getHighestColorCard(cards, CardColor);
                            }
                        }else{
                                card = getLowestColorCard(cards, CardColor);
                            }
                    }else{
                        card = getHighestColorCard(cards, CardColor);
                    }
                }else{
                   var Jacks = searchJacks(cards);
                    if(Jacks.length > 0){
                        card = getLowestJack(Jacks);
                    }else{
                        var DecColor = false;
                        DecColor = checkIFGotDecColor(cards, color);
                        if(DecColor === false){
                            //sprawdzam cyz przyjaciel moze przebic
                            if(FriendCard.charAt(0) === 'J'){
                                card = getHighestCard(cards);
                            }else if(FriendCard.charAt(1) === color){
                                card = getHighestCard(cards);
                            }else if(FriendCard.charAt(1) === CardColor) {
                                var myFriendIsHigher = false;
                                myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, CardColor);
                                if (myFriendIsHigher === false) {
                                    card = getLowestCard(cards);
                                } else {
                                    card = getHighestCard(cards);
                                }
                            }else{
                                card = getLowestCard(cards);
                            }
                        }else{
                            card = getHighestColorCard(cards, color);
                        }
                    }
                }
            }
        } else {
            //1 karta przyjaciela
            if (objGame.firstturn.charAt(0) === 'J') {
             //sprawdzam czy mam J
                var Jacks = searchJacks(cards);
                if(Jacks.length > 0){
                    if(EnemyCard.charAt(0) === 'J'){
                        var myFriendIsHigher = false;
                        myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard, EnemyCard);
                        if(myFriendIsHigher === false){
                            var myIsHigher = false;
                            myIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);
                            if(myIsHigher === false){
                                card = getLowestJack(Jacks);
                            }else{
                                card = getHighestJack(Jacks);
                            }
                        }else{
                            card = getLowestJack(Jacks);
                        }
                    }else{
                        card = getLowestJack(Jacks);
                    }
                }else{
                    if(EnemyCard.charAt(0) === 'J'){
                        var DecColor = false;
                        DecColor = checkIFGotDecColor(cards, color);
                        var myFriendIsHigher = false;
                        myFriendIsHigher = checkIfFriendJCanBeatEnemyJ(FriendCard, EnemyCard);
                        if(myFriendIsHigher === false){
                            if(DecColor === false){
                                card = getLowestCard(cards);
                            }else{
                                card = getLowestColorCard(cards, color);
                            }
                        }else{
                            if(DecColor === false){
                                card = getHighestCard(cards);
                            }else{
                                card = getHighestColorCard(cards, color);
                            }
                        }
                    }else{
                        if(DecColor === false){
                            card = getHighestCard(cards);
                        }else{
                            card = getHighestColorCard(cards, color);
                        }
                    }
                }
            } else if (objGame.firstturn.charAt(1) === color) {
                //sprawdzam czy wróg nie przebije karty przyjaciela
                if (EnemyCard.charAt(0) === 'J') {
                    var Jacks = searchJacks(cards);
                    if (Jacks.length > 0) {
                        //sprawdzamczy ja moge przebic
                        var myJIsHigher = false;
                        myJIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);
                        if (myJIsHigher === false) {
                            card = getLowestJack(Jacks);
                        } else {
                            card = getHighestJack(Jacks);
                        }
                    } else {
                        //przyjaciel pojechal kolorem zadeklarowanym wrog pojechal J ja nie mam J
                        //wróg na pewno przebije przyjaciela
                            var DecColor = false;
                            DecColor = checkIFGotDecColor(cards, color);
                            if (DecColor === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getLowestColorCard(cards, color);
                            }

                    }
                } else if (EnemyCard.charAt(1) === color) {
                    var myFriendIsHigher = false;
                    myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, color);
                    if (myFriendIsHigher === false) {
                        //sprawdzam czy ja nie moge przebic
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            card = getLowestJack(Jacks);
                        } else {
                            var DecColor = false;
                            DecColor = checkIFGotDecColor(cards, color);
                            if (DecColor === false) {
                                card = getLowestCard(cards);
                            } else {
                                var myIsHigher = false;
                                myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, color);
                                if (myIsHigher === false) {
                                    card = getLowestColorCard(cards, color);
                                } else {
                                    card = getHighestColorCard(cards, color);
                                }
                            }
                        }
                    } else {
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            card = getLowestJack(Jacks);
                        } else {
                            var DecColor = false;
                            DecColor = checkIFGotDecColor(cards, color);
                            if (DecColor === false) {
                                card = getHighestCard(cards);
                            } else {
                                card = getHighestColorCard(cards, color);
                            }
                        }
                    }
                } else {
                    //wróg na pewno nie przebije karty przyjaciela
                    var Jacks = searchJacks(cards);
                    if (Jacks.length > 0) {
                        card = getLowestJack(Jacks);
                    } else {
                        var DecColor = false;
                        DecColor = checkIFGotDecColor(cards, color);
                        if (DecColor === false) {
                            card = getHighestCard(cards);
                        } else {
                            card = getHighestColorCard(cards, color);
                        }
                    }
                }
            } else {
                //przyjaciel pojechal w kolorze niezadeklarowanym
                //sprawdzam czy mam kolor jezeli mam nic nie moge zrobic jezeli nie mam moge starac sie przebic karte wroga
                var CardColor = objGame.firstturn.charAt(1);
                var GotColor = false;
                GotColor = checkIFGotDecColor(cards, CardColor);
                if (GotColor === false) {
                    //nie mam koloru pierwszej karty moge starac sie przebic karte wroga
                    if (EnemyCard.charAt(0) === 'J') {
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            //sprawdzamczy ja moge przebic
                            var myJIsHigher = false;
                            myJIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);
                            if (myJIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestJack(Jacks);
                            }
                        } else {
                            card = getLowestCard(cards);
                        }
                    } else if (EnemyCard.charAt(1) === color) {
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            //sprawdzamczy ja moge przebic
                            var myJIsHigher = false;
                            myJIsHigher = checkIFCanBeatJack(EnemyCard, Jacks);
                            if (myJIsHigher === false) {
                                card = getLowestCard(cards);
                            } else {
                                card = getHighestJack(Jacks);
                            }
                        } else {
                            var DecColor = false;
                            DecColor = checkIFGotDecColor(cards, color);
                            if (DecColor === false) {
                                card = getLowestCard(cards);
                            } else {
                                var myIsHigher = false;
                                myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, color);
                                if (myIsHigher === false) {
                                    card = getLowestCard(cards);
                                } else {
                                    card = getHighestColorCard(cards, color);
                                }
                            }
                        }
                    } else {
                     if(EnemyCard.charAt(1) === CardColor){
                         var myFriendIsHigher = false;
                         myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, CardColor);
                         if(myFriendIsHigher === false){
                             var Jacks = searchJacks(cards);
                             if(Jacks.length > 0){
                                 card = getLowestJack(Jacks);
                             }else{
                                 var DecColor = false;
                                 DecColor = checkIFGotDecColor(cards, color);
                                 if(DecColor === false){
                                     card = getLowestCard(cards);
                                 }else{
                                     card = getHighestColorCard(cards, color);
                                 }
                             }
                         }else{
                             card = getHighestCard(cards);
                         }
                     } else{
                         card = getHighestCard(cards);
                     }
                    }
                } else {
                    var CardColor = objGame.firstturn.charAt(1);
                  if(EnemyCard.charAt(1) === CardColor){
                      var myFriendIsHigher = false;
                        myFriendIsHigher = checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, CardColor);
                      if(myFriendIsHigher === false){
                          var myIsHigher = false;
                          myIsHigher = checkIfMyCardCanBeatEnemy(cards, EnemyCard, CardColor);
                          if(myIsHigher === false){
                              card = getLowestColorCard(cards, CardColor);
                          }else{
                              card = getHighestColorCard(cards, CardColor);
                          }
                      }else{
                          card = getHighestColorCard(cards, CardColor);
                      }
                  }else{
                      if(EnemyCard.charAt(0) === 'J' || EnemyCard.charAt(1) === color){
                          card = getLowestColorCard(cards, CardColor);
                      }else{
                          card = getHighestColorCard(cards, CardColor);
                      }
                  }
                }
            }
        }
    }
    return card;
}

function checkIfFriendJCanBeatEnemyJ(FriendCard, EnemyCard){
    var CardColors = [];
    CardColors[0] = 'D';
    CardColors[1] = 'H';
    CardColors[2] = 'S';
    CardColors[3] = 'C';
    var state = false;

    var EnemyCardPos = -1;
    var FriendCardPos = -1;
    for (var i = 0; i < CardColors.length; i++) {
        if (EnemyCard.charAt(1) === CardColors[i]) {
            EnemyCardPos = i;
        } else if (FriendCard.charAt(1) === CardColors[i]) {
            FriendCardPos = i;
        }
    }

    if (FriendCardPos > EnemyCardPos) {
        state = true;
    }

    return state;
}

function getLowestJack(Jacks){
    var CardColors = [];
    CardColors[0] = 'D';
    CardColors[1] = 'H';
    CardColors[2] = 'S';
    CardColors[3] = 'C';
     var card = '';

    for(var j=0;j<CardColors.length;j++){
        for(var i=0;i<Jacks.length;i++){
            if (Jacks[i].charAt(1) === CardColors[j]){
                card = Jacks[i];
                i = Jacks.length;
                j = CardColors.length;
            }
        }
    }

    return card;
}

function getHighestJack(Jacks){
    var CardColors = [];
    CardColors[0] = 'C';
    CardColors[1] = 'S';
    CardColors[2] = 'H';
    CardColors[3] = 'D';
    var card = '';

    for(var j=0;j<CardColors.length;j++){
        for(var i=0;i<Jacks.length;i++){
            if (Jacks[i].charAt(1) === CardColors[j]){
                card = Jacks[i];
                i = Jacks.length;
                j = CardColors.length;
            }
        }
    }

    return card;
}

function checkIfMyCardCanBeatEnemy(cards, EnemyCard, color){
    var EnemyFigurePos = -1;
    var MyFigurePos = -1;
    var state = false;
    var figures = [];
    figures[0] = "7";
    figures[1] = "8";
    figures[2] = "9";
    figures[3] = "Q";
    figures[4] = "K";
    figures[5] = "T";
    figures[6] = "A";

    for (var k = 0; k < figures.length; k++) {
        if (EnemyCard.charAt(0) === figures[k] && EnemyCard.charAt(1) === color) {
            EnemyFigurePos = k;
            k = figures.length;
        }
    }


    for (var j = 0; j < figures.length; j++) {
         for (var i = 0; i < cards.length; i++) {
             if (cards[i].charAt(0) === figures[j] && cards[i].charAt(1) === color) {
                MyFigurePos = j;
            }
        }
    }

        if(MyFigurePos > EnemyFigurePos){
           state = true;
        }

    return state;
}

function checkIfFriendCardCanBeatEnemy(FriendCard, EnemyCard, color){
    var figures = [];
    figures[0] = "7";
    figures[1] = "8";
    figures[2] = "9";
    figures[3] = "Q";
    figures[4] = "K";
    figures[5] = "T";
    figures[6] = "A";
    var state = false;
    var EnemyCardPos = -1;
    var FriendCardPos = -1;

    for(var i=0;i<figures.length;i++){
        if(EnemyCard.charAt(0) === figures[i] && EnemyCard.charAt(1) === color){
            EnemyCardPos = i;
        }else if(FriendCard.charAt(0) === figures[i] && FriendCard.charAt(1) === color){
            FriendCardPos = i;
        }
    }

    if(FriendCardPos > EnemyCardPos){
        state  = true;
    }

    return state;
}

function checkIFGotDecColor(cards, color){
    var DecColor = false;
    for(var i=0;i<cards.length;i++){
        if(cards[i].charAt(1) === color && cards[i].charAt(0) !== 'J'){
            DecColor = true;
            i = cards.length;
        }
    }

    return DecColor;
}

function checkIFCanBeatJack(EnemyJack, MyJacks){
    var CardColors = [];
    CardColors[0] = 'D';
    CardColors[1] = 'H';
    CardColors[2] = 'S';
    CardColors[3] = 'C';
    var state = false;

    var EnemyColorPos = -1;
    var MyColorPos = -1;

    for(var i=0;i<CardColors.length;i++){
        if(CardColors[i] === EnemyJack.charAt(1)){
            EnemyColorPos = i;
            i = CardColors.length;
        }
    }

    for(var i=0;i<MyJacks.length;i++){
        for(var j=0;j<CardColors;j++){
            if(MyJacks[i].charAt(1) === CardColors[j]){
                MyColorPos = j;
            }
        }
    }

    if(MyColorPos > EnemyColorPos){
        state = true;
    }

    return state;
}

function secondMove(room){
    var objDeclaration = getDeclarationObj(room);
    var objComputer = getComputerObj(room);
    var cards = objComputer.cards;
    //zamiana kart tylko na ich id
    var idcards = [];
    var card = '';

    for(var i=0;i<cards.length;i++){
        idcards.push(cards[i].substr(cards[i].indexOf("id")+3,2));
    }

    switch(objDeclaration.basic.trim()) {
        case 'clubs' :
            card = getComputerCardColorSecondMove(idcards, 'C',room);
            break;
        case 'spades' :
            card = getComputerCardColorSecondMove(idcards, 'S',room);
            break;
        case 'hearts' :
            card = getComputerCardColorSecondMove(idcards, 'H',room);
            break;
        case 'diamonds' :
            card = getComputerCardColorSecondMove(idcards, 'D',room);
            break;
        case 'grand' :
            card = getComputerCardGrandSecondMove(idcards, room);
            break;
        case 'null' :
            card = getComputerCardNullNullOuvertSecondThirdMove(idcards,room);
            break;
        case 'null ouvert':
            card = getComputerCardNullNullOuvertSecondThirdMove(idcards,room);
            break;
    }


    //zamiana z postaci id -> kartę
    for(var i=0;i<cards.length;i++){
        if(cards[i].substr(cards[i].indexOf("id")+3,2) === card){
            card = cards[i];
        }
    }
    return card;
}

function firstMove(room){
    var objDeclaration = getDeclarationObj(room);
    var objGame = getGameObj(room);
    var objComputer = getComputerObj(room);
    var cards = objComputer.cards;
    //zamiana kart tylko na ich id
    var idcards = [];
    var card = '';

    for(var i=0;i<cards.length;i++){
        idcards.push(cards[i].substr(cards[i].indexOf("id")+3,2));
    }
    if(objDeclaration.extra === 'ouvert'){
        switch (objDeclaration.basic.trim()) {
            case 'clubs' :
                card = getComputerCardColorOuvertFirstMove(idcards, 'C', room);
                break;
            case 'spades' :
                card = getComputerCardColorOuvertFirstMove(idcards, 'S', room);
                break;
            case 'hearts' :
                card = getComputerCardColorOuvertFirstMove(idcards, 'H', room);
                break;
            case 'diamonds' :
                card = getComputerCardColorOuvertFirstMove(idcards, 'D', room);
                break;
            case 'grand' :
                card = getComputerCardGrandOuvertFirstMove(idcards, room);
                break;
            case 'null':
                card = getLowestCard(idcards);
                break;
        }
    }else {
        switch (objDeclaration.basic.trim()) {
            case 'clubs' :
                card = getComputerCardColorFirstMove(idcards, 'C');
                break;
            case 'spades' :
                card = getComputerCardColorFirstMove(idcards, 'S');
                break;
            case 'hearts' :
                card = getComputerCardColorFirstMove(idcards, 'H');
                break;
            case 'diamonds' :
                card = getComputerCardColorFirstMove(idcards, 'D');
                break;
            case 'grand' :
                card = getComputerCardGrandFirstMove(idcards);
                break;
            case 'null':
                card = getLowestCard(idcards);
                break;
            case 'null ouvert':
                card = getComputerCardNullOuvertFirstMove(idcards, room);
                break;
        }
    }
  //Jako że to pierwszy ruch trzeba zapamietać pierwszą kartę
    objGame.firstturn = card;
    objGame.firstmovepos = objComputer.position.trim();
    app.io.in(room).emit('first turn card', objGame.firstturn, objGame.firstmovepos);

    //zamiana z postaci id -> kartę
    for(var i=0;i<cards.length;i++){
        if(cards[i].substr(cards[i].indexOf("id")+3,2) === card){
            card = cards[i];
        }
    }
    return card;
}

function getComputerCardNullOuvertFirstMove(cards, room){
    var card = '';
    var enemy = [];
    var objBid = getBidObj(room);
    var objCard = getCardsObj(room);
    if(objBid.bidwinner.trim() === 'komputer'){
        //jezeli to komputer jest solista calosc sprowadza sie do wyjechania jak najmniejsza karta
        card = getLowestCard(cards);
    }else {
        switch (objBid.bidwinner.trim()) {
            case objCard.player1login.trim() :
                enemy = objCard.player1;
                break;
            case objCard.player2login.trim() :
                enemy = objCard.player2;
                break;
            case objCard.player3login.trim():
                enemy = objCard.player3;
                break;
        }
        var colors = [];
        colors[0] = 'C';
        colors[1] = 'S';
        colors[2] = 'H';
        colors[3] = 'D';
        var enemyCard = '';
        var myCard = '';
        for(var i=0;i<colors.length;i++){
           enemyCard = getLowestColorCard(enemy, colors[i]);
            myCard = getLowestColorCard(cards, colors[i]);
            if(enemyCard !== '' && myCard !== ''){
                var enemyPos = -1;
                var myPos = -1;
                var figures = [];
                figures[0] = 'A';
                figures[1] = 'K';
                figures[2] = 'Q';
                figures[3] = 'J';
                figures[4] = 'T';
                figures[5] = '9';
                figures[6] = '8';
                figures[7] = '7';
                for(var i=0;i<figures.length;i++){
                    if(figures[i] === enemyCard.charAt(0)){
                        enemyPos = i;
                    }else if(figures[i] === myCard.charAt(0)){
                        myPos = i;
                    }
                }
                if(myPos > enemyPos){
                    card = myCard;
                }
            }
        }
        if(card === ''){
            card = getLowestCard(cards);
        }
    }
    return card;
}

function getComputerCardGrandOuvertFirstMove(idcards, room){
    var card = '';
    var enemy = [];
    var aces = [];
    var jacks = [];
    var objBid = getBidObj(room);
    var objCard = getCardsObj(room);
    if(objBid.bidwinner.trim() === 'komputer'){
        card = getComputerCardGrandFirstMove(idcards);
    }else {
        switch (objBid.bidwinner.trim()) {
            case objCard.player1login.trim() :
                enemy = objCard.player1;
                break;
            case objCard.player2login.trim() :
                enemy = objCard.player2;
                break;
            case objCard.player3login.trim():
                enemy = objCard.player3;
                break;
        }
        //szukam asów
        for (var i = 0; i < idcards.length; i++) {
            if (idcards[i].charAt(0) === 'A'){
                aces.push(idcards[i]);
            }
        }
        if (aces.length > 0) {
            card = aces[0];
        } else {
            //szukam waletów i sprawdzam czy mogę którymś z nich przebić J solisty
            jacks = searchJacks(idcards);
            var enemyJacks = [];
            if (jacks.length > 0) {
                if (enemyJacks.length > 0) {
                    var myJIsHigher = false;
                    for (var i = 0; i < enemyJacks.length; i++) {
                        myJIsHigher = checkIFCanBeatJack(enemyJacks[i], jacks);
                        if (myJIsHigher === true) {
                            card = getHighestJack(jacks);
                            i = enemyJacks.length;
                        }
                    }
                } else {
                    card = getHighestJack(jacks);
                }
            } else {
                var myIsHigher = false;
                var HighestColors = [];
                HighestColors[0] = getHighestColorCard(enemy, 'C');
                HighestColors[1] = getHighestColorCard(enemy, 'S');
                HighestColors[2] = getHighestColorCard(enemy, 'H');
                HighestColors[3] = getHighestColorCard(enemy, 'D');
                var colors = [];
                colors[0] = 'C';
                colors[1] = 'S';
                colors[2] = 'H';
                colors[3] = 'D';
                var temp = '';
                for(var i=0;i<HighestColors.length;i++){
                    myIsHigher = checkIfMyCardCanBeatEnemy(idcards, HighestColors[i], colors[i]);
                    if(myIsHigher === true){
                        card = getHighestColorCard(idcards, colors[i]);
                        i = HighestColors.length;
                    }
                }
                if(card === ''){
                    card = getHighestCard(idcards);
                }
            }
        }
    }
    return card;
}

function getComputerCardNullNullOuvertSecondThirdMove(cards, room){
    var objGame = getGameObj(room);
    var DecColor = false;
    var card = '';
    DecColor = checkIFGotDecColor(cards, objGame.firstturn.charAt(1));
    if(DecColor === false){
        card = getLowestCard(cards);
    }else{
        card = getLowestColorCard(cards, objGame.firstturn.charAt(1));
    }
    return card;
}

function getComputerCardGrandFirstMove(idcards){
    var aces = [];
    var jacks = [];
    var figures = [];
    figures[0] = "A";
    figures[1] = "T";
    figures[2] = "K";
    figures[3] = "Q";
    figures[4] = "9";
    figures[5] = "8";
    figures[6] = "7";
    var card = '';
    //szukam asów
    for(var i=0;i<idcards.length;i++){
        if(idcards[i].charAt(0) === 'A'){
            aces.push(idcards[i]);
        }
    }
    if(aces.length > 0){
        card = aces[0]; 
    }else {
        //szukam waletów
        for (var i = 0; i < idcards.length; i++) {
            if (idcards[i].charAt(0) === 'J') {
                jacks.push(idcards[i]);
            }
        }

        if (jacks.length > 0) {
            card = jacks[0];
        } else {
            //szukam najwyzszej karty
            for (var j = 0; j < figures.length; j++) {
                for (var i = 0; i < idcards.length; i++) {
                    if (idcards[i].charAt(0) === figures[j]) {
                        card = idcards[i];
                        i = idcards.length;
                        j = figures.length;
                    }
                }
            }
        }
    }
    return card;
}

function getComputerCardColorOuvertFirstMove(idcards, color, room){
var card = '';
   //asy J kolor niezadeklarowany
    var enemy = [];
    var aces = [];
    var jacks = [];
    var objBid = getBidObj(room);
    var objCard = getCardsObj(room);
    if(objBid.bidwinner.trim() === 'komputer'){
        //jezeli to komputer jest solista to nie patrzy na karty tylko wyjezdza normalnie
        card =  getComputerCardColorFirstMove(idcards, color);
    }else {
        switch (objBid.bidwinner.trim()) {
            case objCard.player1login.trim() :
                enemy = objCard.player1;
                break;
            case objCard.player2login.trim() :
                enemy = objCard.player2;
                break;
            case objCard.player3login.trim():
                enemy = objCard.player3;
                break;
        }
        //szukam asów nie w kolorze
        for(var i=0;i<idcards.length;i++){
            if(idcards[i].charAt(0) === 'A' && idcards[i].charAt(1) !== color.trim()){
                aces.push(idcards[i]);
            }
        }
        if(aces.length > 0){
            card = aces[0];
        }else{
            //szukam waletów i sprawdzam czy mogę którymś z nich przebić J solisty
            jacks = searchJacks(idcards);
            var enemyJacks = [];
            if(jacks.length > 0){
               if(enemyJacks.length > 0 ){
                   var myJIsHigher = false;
                   for(var i=0;i<enemyJacks.length;i++){
                       myJIsHigher = checkIFCanBeatJack(enemyJacks[i], jacks);
                       if(myJIsHigher === true){
                           card = getHighestJack(jacks);
                           i = enemyJacks.length;
                       }
                   }
               }else{
                   card = getHighestJack(jacks);
               }
            }else{
                var myIsHigher = false;
                var enemytemp = getHighestColorCard(enemy, color);
                myIsHigher = checkIfMyCardCanBeatEnemy(idcards, enemytemp, color);
                if(myIsHigher === false){
                    card = getHighestCard(idcards);
                }else{
                   card = getHighestColorCard(idcards, color);
                }
            }
        }
    }
return card;
}

function getComputerCardColorFirstMove(idcards,color){
    var aces = [];
    var jacks = [];
    var figures = [];
    figures[0] = "A";
    figures[1] = "T";
    figures[2] = "K";
    figures[3] = "Q";
    figures[4] = "9";
    figures[5] = "8";
    figures[6] = "7";
    var card = '';

    //szukam asów nie w kolorze
    for(var i=0;i<idcards.length;i++){
        if(idcards[i].charAt(0) === 'A' && idcards[i].charAt(1) !== color.trim()){
            aces.push(idcards[i]);
        }
    }
    if(aces.length > 0){
        card = aces[0];
    }else{
        //szukam waletów
        for(var i=0;i<idcards.length;i++){
            if(idcards[i].charAt(0) === 'J'){
                jacks.push(idcards[i]);
            }
        }

        if(jacks.length > 0){
            card = jacks[0];
        }else{
            //szukam najwyzszej karty z koloru niezadeklarowanego
            for(var i=0;i<idcards.length;i++){
                for(var j=0;j<figures.length;j++){
                    if(idcards[i].charAt(0) === figures[j] && idcards[i].charAt(1) !== color.trim()){
                        card = idcards[i];
                        i = idcards.length;
                        j = figures.length;
                    }
                }
            }

            //moze sie zdarzy ze mam tylko karty w kolorze zadeklarowanym
            //wtedy pojade najwyzsza w kolorze zadeklarowanym
            if(card === ''){
                card = getHighestColorCard(idcards, color);
            }
        }
    }
    return card;
}

function getComputerCardColorSecondMove(cards,color,room) {
    var objGame = getGameObj(room);
    var card = '';
    var objBid = getBidObj(room);
    if(objBid.bidwinner.trim() === 'komputer') {
        //1 karta nalezy do wroga
        if (objGame.firstturn.charAt(0) === 'J') {
            var Jacks = searchJacks(cards);
            if (Jacks.length > 0) {
                var myJIsHigher = false;
                myJIsHigher = checkIFCanBeatJack(objGame.firstturn.trim(), Jacks);
                if (myJIsHigher === false) {
                    card = getLowestJack(Jacks);
                } else {
                    card = getHighestJack(Jacks);
                }
            } else {
                var DecColor = false;
                DecColor = checkIFGotDecColor(cards, color);
                if (DecColor === false) {
                    card = getLowestCard(cards);
                } else {
                    card = getLowestColorCard(cards, color);
                }
            }
        } else if (objGame.firstturn.charAt(1) === color) {
            var Jacks = searchJacks(cards);
            if (Jacks.length > 0) {
                //nawet najmniejszy J przebije kolor zadeklarowany
                card = getHighestJack(Jacks);
            } else {
                var DecColor = false;
                DecColor = checkIFGotDecColor(cards, color);
                if (DecColor === false) {
                    card = getLowestCard(cards);
                } else {
                    //sprawdzam czy moge przebic
                    var myIsHigher = false;
                    myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), color);
                    if (myIsHigher === true) {
                        card = getHighestColorCard(cards, color);
                    } else {
                        card = getLowestColorCard(cards, color);
                    }
                }
            }
        } else {
            //oznacza to ze wrog pojechal karta w kolorze niezadeklarowanym
            var CardColor = objGame.firstturn.charAt(1);
            var GotColor = false;
            GotColor = checkIFGotDecColor(cards, CardColor);
            if (GotColor === false) {
                var Jacks = searchJacks(cards);
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    card = getLowestJack(Jacks);
                } else {
                    var DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        card = getLowestCard(cards);
                    } else {
                        card = getHighestColorCard(cards, color);
                    }
                }
            } else {
                //sprawdzam czy moge przebic
                var myIsHigher = false;
                myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), CardColor);
                if (myIsHigher === false) {
                    card = getLowestColorCard(cards, CardColor);
                } else {
                    card = getHighestColorCard(cards, CardColor);
                }
            }
        }
    }else {
        if (IfEnemyCard(room) === true) {
            //1 karta nalezy do wroga
            if (objGame.firstturn.charAt(0) === 'J') {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    var myJIsHigher = false;
                    myJIsHigher = checkIFCanBeatJack(objGame.firstturn.trim(), Jacks);
                    if (myJIsHigher === false) {
                        card = getLowestJack(Jacks);
                    } else {
                        card = getHighestJack(Jacks);
                    }
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        card = getLowestCard(cards);
                    } else {
                        card = getLowestColorCard(cards, color);
                    }
                }
            } else if (objGame.firstturn.charAt(1) === color) {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    //nawet najmniejszy J przebije kolor zadeklarowany
                    card = getHighestJack(Jacks);
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        card = getLowestCard(cards);
                    } else {
                        //sprawdzam czy moge przebic
                        var myIsHigher = false;
                        myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), color);
                        if (myIsHigher === true) {
                            card = getHighestColorCard(cards, color);
                        } else {
                            card = getLowestColorCard(cards, color);
                        }
                    }
                }
            } else {
                //oznacza to ze wrog pojechal karta w kolorze niezadeklarowanym
                var CardColor = objGame.firstturn.charAt(1);
                var GotColor = false;
                GotColor = checkIFGotDecColor(cards, CardColor);
                if (GotColor === false) {
                    var Jacks = searchJacks(cards);
                    var Jacks = searchJacks(cards);
                    if (Jacks.length > 0) {
                        card = getLowestJack(Jacks);
                    } else {
                        var DecColor = checkIFGotDecColor(cards, color);
                        if (DecColor === false) {
                            card = getLowestCard(cards);
                        } else {
                            card = getHighestColorCard(cards, color);
                        }
                    }
                } else {
                    //sprawdzam czy moge przebic
                    var myIsHigher = false;
                    myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), CardColor);
                    if (myIsHigher === false) {
                        card = getLowestColorCard(cards, CardColor);
                    } else {
                        card = getHighestColorCard(cards, CardColor);
                    }
                }
            }
        } else {
            //1 karta nalezy do przyjaciela
            if (objGame.firstturn.charAt(0) === 'J') {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    card = getLowestJack(Jacks);
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        card = getHighestCard(cards);
                    } else {
                        card = getHighestColorCard(cards, color);
                    }
                }
            } else if (objGame.firstturn.charAt(1) === color) {
                var Jacks = searchJacks(cards);
                if (Jacks.length > 0) {
                    card = getHighestJack(Jacks);
                } else {
                    var DecColor = false;
                    DecColor = checkIFGotDecColor(cards, color);
                    if (DecColor === false) {
                        card = getHighestCard(cards);
                    } else {
                        card = getHighestColorCard(cards, color);
                    }
                }
            } else {
                //oznacza to ze przyjaciel pojechal kolorem niezadeklarowanym
                var CardColor = objGame.firstturn.charAt(1);
                var GotColor = false;
                GotColor = checkIFGotDecColor(cards, CardColor);
                if (GotColor === false) {
                    var Jacks = searchJacks(cards);
                    var Jacks = searchJacks(cards);
                    if (Jacks.length > 0) {
                        card = getHighestJack(Jacks);
                    } else {
                        var DecColor = false;
                        DecColor = checkIFGotDecColor(cards, color);
                        if (DecColor === false) {
                            card = getHighestCard(cards);
                        } else {
                            card = getHighestColorCard(cards, color);
                        }
                    }
                } else {
                    card = getHighestColorCard(cards, CardColor);
                }
            }
        }
    }
   return card;
}

function getComputerCardGrandSecondMove(cards, room){
    var objGame = getGameObj(room);
    var card = '';
    var getColor = false;
    var objBid = getBidObj(room);

    if (objBid.bidwinner.trim() === 'komputer') {
        if (objGame.firstturn.charAt(0) === 'J') {
            var Jacks = searchJacks(cards);
            //sprawdzamy czy mamy J
            if (Jacks.length > 0) {
                var myJIsHigher = false;
                myJIsHigher = checkIFCanBeatJack(objGame.firstturn.trim(), Jacks);
                if (myJIsHigher === false) {
                    card = getHighestJack(Jacks);
                } else {
                    card = getLowestJack(Jacks);
                }
            }else{
                card = getLowestCard(cards);
            }
        }else{
            var CardColor = objGame.firstturn.charAt(1);
            var GotColor = checkIFGotDecColor(cards, CardColor);
            if(GotColor === false){
                var Jacks = searchJacks(cards);
                //sprawdzamy czy mamy J
                if (Jacks.length > 0) {
                    var myJIsHigher = false;
                    myJIsHigher = checkIFCanBeatJack(objGame.firstturn.trim(), Jacks);
                    if (myJIsHigher === false) {
                        card = getHighestJack(Jacks);
                    } else {
                        card = getLowestJack(Jacks);
                    }
                }else{
                    card = getLowestCard(cards);
                }
            }else{
                var myIsHigher = false;
                myIsHigher = checkIfMyCardCanBeatEnemy(cards, objGame.firstturn.trim(), CardColor);
                if(myIsHigher === false){
                    card = getLowestColorCard(cards, CardColor);
                }else{
                    card = getHighestColorCard(cards, CardColor);
                }
            }
        }
    }else{
        //sprawdzamy czy to J
            if (objGame.firstturn.charAt(0) === 'J') {
                var Jacks = searchJacks(cards);
                //sprawdzamy czy mamy J
                if (Jacks.length > 0) {
                    //sprawdzamy do kogo nalezy karta do wwrgoa czy przyjaciela
                    if (IfEnemyCard(room) === true) {
                        //sprawdzam czy moge przebic
                        var myJIsHigher = false;
                        myJIsHigher = checkIFCanBeatJack(objGame.firstturn.trim(), Jacks);
                        if (myJIsHigher === false) {
                            card = getHighestJack(Jacks);
                        } else {
                            card = getLowestJack(Jacks);
                        }
                    } else {
                        //karta nalezy do przyjaciela
                        //jedz najwiekszym dupkiem
                        card = getHighestJack(Jacks);
                    }
                } else {
                    //nie mam J
                    //sprawdzam do kogo nalezy karta
                    if (IfEnemyCard(room) === true) {
                        //karta nalezy do wroga
                        //jedz najmniejsza jaka masz
                        //szukam najmniejszej karty
                        card = getLowestCard(cards);
                    } else {
                        //karta nalezy do przyjaciela
                        //jezdz najwieksza jaka masz
                        //szukam największej karty
                        card = getHighestCard(cards);
                    }
                }
            } else {
                //sprawdz czy masz kartę w kolorze pierwszej karty
                var getColor = false;
                getColor = checkIFGotDecColor(cards, objGame.firstturn.charAt(1));
                if (getColor === true) {
                    //mam karte w kolorze sprawdzam do kogo nalezy ta karta
                    if (IfEnemyCard(room) === true) {
                        //karta nalezy do wroga
                        //jade najmniejsza w kolorze
                        card = getLowestColorCard(cards, objGame.firstturn.charAt(1));
                    } else {
                        //karta nalezy do przyjaciela
                        //jade najwieksza w kolorze
                        card = getHighestColorCard(cards, objGame.firstturn.charAt(1));
                    }
                } else {
                    //nie mam karty w kolorze
                    if (IfEnemyCard(room) === true) {
                        //karta nalezy do wroga
                        //jedz najmniejsza jaka masz
                        //szukam najmniejszej karty
                        var Jacks = searchJacks(cards);
                        if (Jacks.length > 0) {
                            card = getLowestJack(Jacks);
                        } else {
                            card = getLowestCard(cards);
                        }
                    } else {
                        //karta nalezy do przyjaciela
                        //jezdz najwieksza jaka masz
                        //szukam najwiekszej karty
                        card = getHighestCard(cards);
                    }
                }
            }
        }
    return card;
}


function IfEnemyCard(room){
    var objCard = getCardsObj(room);
    var objBid = getBidObj(room);
    var login = '';
    var state = false;

    if (objCard.firstmiddle !== null) {
        login = objCard.player1login.trim();
    } else if (objCard.secondmiddle !== null) {
        login = objCard.player2login.trim();
    } else if (objCard.thirdmiddle !== null) {
        login = objCard.player3login.trim();
    }

    if(objBid.bidwinner.trim() === 'komputer'){
            state = true;
    }else if(objBid.bidwinner.trim() !== 'komputer'){
        if(objBid.bidwinner.trim() === login){
            state = true;
        }
    }

    return state;
}

function getLowestColorCard(cards, color){
    var card = '';
    var figures = [];
    figures[0] = "7";
    figures[1] = "8";
    figures[2] = "9";
    figures[3] = "Q";
    figures[4] = "K";
    figures[5] = "T";
    figures[6] = "A";

    for (var j = 0; j < figures.length; j++) {
          for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(0) === figures[j] && cards[i].charAt(1) === color) {
                card = cards[i];
                i = cards.length;
                j = figures.length;
            }
        }
    }
    return card;
}

function getHighestColorCard(cards, color){
    var card = '';
    var figures = [];
    figures[0] = "A";
    figures[1] = "T";
    figures[2] = "K";
    figures[3] = "Q";
    figures[4] = "9";
    figures[5] = "8";
    figures[6] = "7";

    for (var j = 0; j < figures.length; j++) {
         for (var i = 0; i < cards.length; i++) {
            if (cards[i].charAt(0) === figures[j] && cards[i].charAt(1) === color) {
                card = cards[i];
                i = cards.length;
                j = figures.length;
            }
        }
    }
    return card;
}

function peoplePassBid(room, passed){
    var objBid  = getBidObj(room);
    if (objBid.first === null) {
        objBid.first = passed;
        switch(passed.trim()){
            case 'srodek' :  objBid.q = 'zadek'; break;
            case 'przodek':  objBid.q = 'zadek'; objBid.a = 'srodek'; break;
        }

        if (objBid.bidpos !== null) {
            var val = objBid.bidpos;
            app.io.in(room).emit('bid', bidvalues[val+1],bidvalues[val+2],bidvalues[val+3], objBid.q);
        } else {
            app.io.in(room).emit('bid', bidvalues[0],bidvalues[1],bidvalues[2], objBid.q);
        }

    } else if (objBid.second === null) {
        var objGame = getGameObj(room);
        objBid.second = passed;
        var positions = objGame.positions;
        var players = objGame.players;
        var temp = -1;

        for (var i = 0; i < positions.length; i++) {
            if (positions[i].trim() !== objBid.first.trim()) {
                if (positions[i].trim() !== objBid.second.trim()) {
                    temp = i;
                    i = positions.length;
                }
            }
        }
        objBid.bidwinner = players[temp];
        app.io.in(room).emit('bid winner', objBid.bidwinner);

            if (objBid.first.trim() === 'srodek' && objBid.second.trim() === 'zadek' && objBid.bidpos === null) {
                app.io.in(room).emit('ask eighteen', objBid.bidwinner);
            } else {
                app.io.in(room).emit('ask skat', objBid.bidwinner);
            }

    }else if(objBid.first !== null && objBid.second !== null){
        app.io.in(room).emit('three passes');
    }
}


module.exports = app;
