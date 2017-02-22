var mongoose = require('mongoose');
var StatisticSchema = mongoose.Schema({
    statistic : {
        userid       : String,
        played       : Number,
        won          : Number,
        color        : Number,
        grand        : Number,
        nullgame     : Number,
        declaration  : Number
    }
});
var Statistic = module.exports = mongoose.model('Statistic',StatisticSchema);
module.exports.createStatistic = function(newStatistic, callback){
    newStatistic.save(callback);
};
module.exports.getStatistic = function(id, callback){
    Statistic.findOne({'statistic.userid': id}, callback);
};
module.exports.updateWin = function(id, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$inc:{'statistic.won':1}}, callback);
};
module.exports.updatePlayed = function(id, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$inc:{'statistic.played':1}}, callback);
};
module.exports.updateColor = function(id, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$inc:{'statistic.color':1}}, callback);
};
module.exports.updateGrand = function(id, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$inc:{'statistic.grand':1}}, callback);
};
module.exports.updateNull = function(id, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$inc:{'statistic.nullgame':1}}, callback);
};
module.exports.updateDeclaration = function(id, declaration, callback){
    Statistic.findOneAndUpdate({'statistic.userid': id}, {$set:{'statistic.declaration': declaration}}, callback);
};