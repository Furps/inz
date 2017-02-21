var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');


//User schema
var UserSchema = mongoose.Schema({
    user : {
        id           : String,
        token        : String,
        login        : String,
        password     : String,
        email        : String,
        suits        : String
    }
 });

var User = module.exports = mongoose.model('User',UserSchema);

module.exports.createUser = function(newUser, callback){
    bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(newUser.user.password, salt, function(err, hash) {
            newUser.user.password = hash;
            newUser.save(callback);
        });
    });
};

module.exports.test = function(login, callback){
    User.find( {'user.login' : login}, callback);
};

module.exports.getUserByEmail = function(email, callback){
    var query = {'user.email': email};
    User.findOne(query,callback);
};

module.exports.getUserById = function(id, callback){
    User.findById(id,callback);
};

module.exports.getUserByUsername = function(login, callback){
    var query = {'user.login': login};
    User.findOne(query, callback);
};

module.exports.changeSuit = function(id, suit, callback){
    User.findOneAndUpdate({_id: id}, {$set:{'user.suits':suit}}, callback);
};

module.exports.comparePassword = function(candidatePassword,hash, callback){
    bcrypt.compare(candidatePassword, hash, function(err, isMatch) {
        if(err){ throw err };
        callback(null, isMatch);
    });
};

module.exports.tests = function(profileid, callback){
    User.findOne({'user.id': profileid}, callback);
};

module.exports.createUser2 = function(newUser, callback){
    newUser.save(callback);
};