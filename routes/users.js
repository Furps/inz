var express = require('express');
var router = express.Router();
var User = require('../models/user');
var Statistic = require('../models/statistic');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;

router.get('/login', function (req, res) {
    res.render('login');
});
    router.get('/register', function (req, res){
        res.render('register');
    });
    router.get('/lobby', ensureAuthenticated, function (req, res){
        res.render('lobby', {user: req.user.user});
    });
   router.get('/rooms', function (req, res){
    res.render('rooms');
    });
    router.get('/game/:id', ensureAuthenticated, function (req, res){
     res.render('game', {user: req.user.user});
});
router.post('/game/:id', function (req, res){
    switch(req.body.declarer){
        case req.user.user.login :
             switch(req.body.status){
                 case 'wygrana' :
                     Statistic.updateWin(req.user.id, function (err){
                         if (err) throw err;
                     });
                     Statistic.updatePlayed(req.user.id, function (err){
                         if (err) throw err;
                     });
                     switch(req.body.played){
                         case 'clubs':
                             Statistic.updateColor(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                         case 'spades':
                             Statistic.updateColor(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                         case 'hearts':
                             Statistic.updateColor(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                         case 'diamonds':
                             Statistic.updateColor(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                         case 'grand':
                             Statistic.updateGrand(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                         case 'null':
                             Statistic.updateNull(req.user.id, function (err){
                                 if (err) throw err;
                             });
                             break;
                     }
                     Statistic.getStatistic(req.user.id, function (err,statistic){
                         if (err) throw err;
                         if(statistic){
                             if(statistic.statistic.declaration < req.body.declaration){
                                 Statistic.updateDeclaration(req.user.id, req.body.declaration, function (err){
                                     if (err) throw err;
                                 });
                             }
                         }
                     });
                     break;
                 case 'przegrana':
                     Statistic.updatePlayed(req.user.id, function (err){
                         if (err) throw err;
                     });
                     break;
             }
            break;
        default: 
            switch(req.body.status){
                case 'wygrana' :
                    Statistic.updatePlayed(req.user.id, function (err){
                        if (err) throw err;
                    });
                    break;
                case 'przegrana': 
                    Statistic.updateWin(req.user.id, function (err){
                        if (err) throw err;
                    });
                    Statistic.updatePlayed(req.user.id, function (err){
                        if (err) throw err;
                    });
                    break;
            }
            break;
    }
});
router.post('/lobby', function (req, res){
    Statistic.getStatistic(req.user.id, function (err,statistic){
        if (err) throw err;
        res.writeHead('200', {"Content-Type": "text/json"});
        res.end(JSON.stringify(statistic));
    });
});
    function ensureAuthenticated(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        } else {
            res.redirect('/');
        }
    }
    router.get('/logfb', passport.authenticate('facebook', {scope: 'email'}));
    router.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });
router.get('/logfb/return', passport.authenticate('facebook', {
    successRedirect: '/users/lobby',
    failureRedirect: '/',
    failureFlash: true
}));
    router.post('/login', passport.authenticate('local', {
        successRedirect: '/users/lobby',
        failureRedirect: '/users/login',
        failureFlash: true,
        badRequestMessage : 'Wypełnij wszystkie pola!'
    }));
    router.post('/register', function (req, res){
        var login = req.body.login;
        var email = req.body.email;
        var password = req.body.password;
        var password2 = req.body.password2;

        req.checkBody('login', 'Pole login jest puste').notEmpty();
        req.checkBody('email', 'Pole email jest puste').notEmpty();
        req.checkBody('password', 'Pole hasło jest puste').notEmpty();
        req.checkBody('password2', 'Pole powtórz hasło jest puste').notEmpty();
        req.checkBody('email', 'Email nie jest poprawny').isEmail();
        req.checkBody('password2', 'Hasła nie są takie same').equals(password);
        req.assert('password', 'Wymagana długość hasła to 5-15 znaków').len(5, 15);

        var errors = req.validationErrors();
        if (errors) {
            res.render('register', {
                errors: errors
            });
        } else{
            var newUser = new User();
            newUser.user.id = null; 
            newUser.user.token = null;
            newUser.user.login = login;
            newUser.user.password = password;
            newUser.user.email = email;
            newUser.user.suits = 'french';

            User.test(login, function (err, user) {
                if (err) throw err;
                if (user.length > 0) {
                    req.flash('error_msg', 'Nazwa użytkownka zajęta');
                    res.redirect('/users/register');
                } else {
                    User.createUser(newUser, function (err){
                        if (err) throw err;
                    });
                     var newStatistic = new Statistic();
                     newStatistic.statistic.userid = newUser.id;
                     newStatistic.statistic.played = 0;
                     newStatistic.statistic.won = 0;
                     newStatistic.statistic.color = 0;
                     newStatistic.statistic.grand = 0;
                     newStatistic.statistic.nullgame = 0;
                     newStatistic.statistic.declaration = 0;
                    Statistic.createStatistic(newStatistic, function (err){
                        if (err) throw err;
                        req.flash('success_msg', 'Zarejestrowano pomyślnie');
                        res.redirect('/users/register');
                    });
                }
            });
        }
    });
router.post('/suits', function (req, res){
    if(req.body.suit === undefined ) req.body.suit = 'french';
    User.changeSuit(req.user.id, req.body.suit, function (err){
        if (err) throw err;
    });
});
passport.serializeUser(function (user, done){
    done(null, user.id);
});
passport.deserializeUser(function (id, done) {
   User.getUserById(id, function (err, user) {
        if(user){
            done(err, user);
        }
   });
});
passport.use(new LocalStrategy(
    function (username, password, done) {
        User.getUserByUsername(username, function (err, user) {
            if (err) throw err;
            if (!user) {
                return done(null, false, {message: 'Błędne dane'});
            }
            User.comparePassword(password, user.user.password, function (err, isMatch) {
                if (err) throw err;
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, {message: 'Błędne dane'});
                }
            });
        });
    }));
passport.use(new FacebookStrategy({
        clientID: 308956806118166,
        clientSecret: 'c92e9be2bca727220452aba0812a7d25',
        callbackURL: "http://inz.herokuapp.com/users/logfb/return"
    },
    function (token, refreshToken, profile, done) {
        process.nextTick(function () {
            User.tests(profile.id, function (err, user) {
                if (err) throw err;
                if (user) {
                    return done(null, user);
                } else {
                    var newUser = new User();
                    newUser.user.id = profile.id;
                    newUser.user.token = token;
                    newUser.user.login = profile.displayName;
                    newUser.user.password = null;
                    newUser.user.email = null;
                    newUser.user.suits = 'french';
                    User.createUser2(newUser, function (err, user){
                        if (err) throw err;
                        return done(null, newUser);
                    });
                    var newStatistic = new Statistic();
                    newStatistic.statistic.userid = newUser.id;
                    newStatistic.statistic.played = 0;
                    newStatistic.statistic.won = 0;
                    newStatistic.statistic.color = 0;
                    newStatistic.statistic.grand = 0;
                    newStatistic.statistic.nullgame = 0;
                    newStatistic.statistic.declaration = 0;
                    Statistic.createStatistic(newStatistic, function (err){
                        if (err) throw err;
                    });
                }
            });
        });
    }));
module.exports = router;