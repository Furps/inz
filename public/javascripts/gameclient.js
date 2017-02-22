var socket = io();
var room = "none";
var BidList = [];
var DeclarationList = [];
var GameList = [];
var closeResult = false;
var closePass = false;
var suits = 'french';
var confirmbetClose = false;
var bidmodalClose = false;
var gamedeclarationClose = false;
var askaboutskatClose = false;
var askeighteenClose = false;
var showcards = false;

var matchColors = [];
matchColors[0] = 'C';
matchColors[1] = 'S';
matchColors[2] = 'H';
matchColors[3] = 'D';


$(document).ready(function () {

    var path = window.location.pathname;
    var arr = path.split("/");
    room = arr[3];

    function closeAllModals() {
        closePass = true;
        confirmbetClose = true;
        bidmodalClose = true;
        gamedeclarationClose = true;
        askaboutskatClose = true;
        askeighteenClose = true;
        $('#confirm-bet').modal('hide');
        $('#bid-modal').modal('hide');
        $('#game-declaration').modal('hide');
        $('#ask-about-skat').modal('hide');
        $('#results').modal('hide');
        $('#leave').modal('hide');
        $('#passes').modal('hide');
        $('#ask-eighteen').modal('hide');
        closePass = false;
        confirmbetClose = false;
        bidmodalClose = false;
        gamedeclarationClose = false;
        askaboutskatClose = false;
        askeighteenClose = false;
    }

    function getBidObj(room) {
        var obj;
        for (var i = 0; i < BidList.length; i++) {
            obj = BidList[i];
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

    function getGameObj(room) {
        var obj;
        for (var i = 0; i < GameList.length; i++) {
            obj = GameList[i];
            if (obj.room === room) break;
        }
        return obj;
    }

    function createCardColors(clubs, spades, hearts, diamonds) {
        var colors = [];
        colors[0] = clubs;
        colors[1] = spades;
        colors[2] = hearts;
        colors[3] = diamonds;
        return colors;
    }

    function sortCards(array) {
        var clubs = [];
        var spades = [];
        var hearts = [];
        var diamonds = [];
        var clear = [];

        var figures = [];
        figures[0] = "A";
        figures[1] = "T";
        figures[2] = "K";
        figures[3] = "Q";
        figures[4] = "9";
        figures[5] = "8";
        figures[6] = "7";

        if (array !== null) {
            for (var i = 0; i < array.length; i++) {
                switch ($(array[i]).attr('id').charAt($(array[i]).attr('id').length - 1)) {
                    case 'C':
                        clubs.push(array[i]);
                        break;
                    case 'S':
                        spades.push(array[i]);
                        break;
                    case 'H':
                        hearts.push(array[i]);
                        break;
                    case 'D':
                        diamonds.push(array[i]);
                        break;
                }
            }

            var colors = createCardColors(clubs, spades, hearts, diamonds);

            //Szukanie waletów
            for (var i = 0; i < colors.length; i++) {
                for (var j = 0; j < colors[i].length; j++) {
                    if ($(colors[i][j]).attr('id').charAt($(colors[i][j]).attr('id').length - 2) === "J") {
                        clear.push(colors[i][j]);
                    }
                }
            }

            //Ustawianie reszty kart
            for (var i = 0; i < colors.length; i++) {
                for (var z = 0; z < figures.length; z++) {
                    for (var j = 0; j < colors[i].length; j++) {
                        if ($(colors[i][j]).attr('id').charAt($(colors[i][j]).attr('id').length - 2) === figures[z]) {
                            clear.push(colors[i][j]);
                        }
                    }
                }
            }
        }
        return clear;
    }

    function getMyCards(){
        var newcards = [];
        var card = '';
        $('.mycards img').each(function () {
            $(this).attr('id').charAt(0);
            if (suits === 'german') {
                //jezeli uzytkownik ma niemieckie karty trzeba przed wyslaniem zamienic na francuskie
                card= toFrenchSuit('<img src=' + $(this).attr("src") + ' ' + 'id=' + $(this).attr("id") + '>');
            } else {
                card = '<img src=' + $(this).attr("src") + ' ' + 'id=' + $(this).attr("id") + '>';
            }
            newcards.push(card);
        });
        return newcards;
    }

    function searchJacks() {
        var exist = false;
        $('.mycards img').each(function () {
            if ($(this).attr('id').charAt(0) === 'J') {
                exist = true;
                return false;//to break
            }
        });
        return exist;
    }

    function searchDeclaredColor() {
        var exist = false;
        $('.mycards img').each(function () {
            if ($(this).attr('id').charAt(1) === getDeclaredColor()) {
                exist = true;
                return false;//to break
            }
        });
        return exist;
    }

    function searchTheSameColor(color) {
        var exist = false;
        $('.mycards img').each(function () {
            if ($(this).attr('id').charAt(1) === color && $(this).attr('id').charAt(0) !== 'J') {
                exist = true;
                return false;//to break
            }
        });
        return exist;
    }

    function searchTheSameColorNull(color) {
        var exist = false;
        $('.mycards img').each(function () {
            if ($(this).attr('id').charAt(1) === color) {
                exist = true;
                return false;//to break
            }
        });
        return exist;
    }

    function getDeclaredColor() {
        var obj = getDeclarationObj(room);
        if (obj.declaredgame === "clubs") return 'C';
        if (obj.declaredgame === "spades")   return 'S';
        if (obj.declaredgame === "hearts")  return 'H';
        if (obj.declaredgame === "diamonds")  return 'D';
    }

    function addCard(q) {
        var objGame = getGameObj(room);
        $('.second-card').append(q);
        if (suits === 'german') {
            //jezeli uzytkownik ma niemieckie karty trzeba przed wyslaniem zamienic na francuskie
            q = toFrenchSuit('<img src=' + $(q).attr("src") + ' ' + 'id=' + $(q).attr("id") + '>');
        } else {
            q = '<img src=' + $(q).attr("src") + ' ' + 'id=' + $(q).attr("id") + '>';
        }
        socket.emit('send card', room, q);
        objGame.canclick = false;
    }

    function PlayerMoveReaction(card){
        addCard(card);
        checkIfFirst();
        if ($('.second-card').find('img').attr('id') === undefined ||
            $('.first-card').find('img').attr('id') === undefined ||
            $('.third-card').find('img').attr('id') === undefined) {
            socket.emit('next turn', room);
        }
        checkGameType();
        if ($('.mycards').find('img').length === 0) socket.emit('zero cards', room);
        card = '<img src=' + $(card).attr("src") + ' ' + 'id=' + $(card).attr("id") + '>';
        socket.emit('send card to hide', room, card);
    }

    function checkIfFirst(){
        if ($('.first-card').find('img').attr('id') === undefined && $('.third-card').find('img').attr('id') === undefined) {
            socket.emit('first turn card', room, $('.second-card').find('img').attr('id'), $('.mypos').text());
        }
    }
    function checkGameType() {
        var objDeclaration = getDeclarationObj(room);
        if ($('.second-card').find('img').attr('id') !== undefined &&
            $('.first-card').find('img').attr('id') !== undefined &&
            $('.third-card').find('img').attr('id') !== undefined) {

            if (objDeclaration.declaredgame.trim() === 'clubs' ||
                objDeclaration.declaredgame.trim() === 'spades' ||
                objDeclaration.declaredgame.trim() === 'hearts' ||
                objDeclaration.declaredgame.trim() === 'diamonds'
            ) {
                socket.emit('checkColorTurnEnd client', room);
        } else if (objDeclaration.declaredgame.trim() === 'grand') {
            socket.emit('checkGrandTurnEnd client', room);
        } else if (objDeclaration.declaredgame.trim() === 'null' || objDeclaration.declaredgame.trim() === 'null ouvert') {
            socket.emit('checkNullTurnEnd client', room);
        }
    }
}

    $('input[name=basic]').on('click', function () {
        var objGame = getGameObj(room);
        if ($('input[name=basic]:checked').val() === 'null ouvert' || $('input[name=basic]:checked').val() === 'null') {
            $('.secondclass').hide();
            $('input[name=extrapoint]').removeAttr('checked');
        } else {
            if (objGame.hiddenextrapoints !== true) $('.secondclass').show();
        }
    });

    function createBid() {
        var NewBid = {
            room: room,
            bet: null,
            confirmbet: null
        };

        BidList.push(NewBid);
    }

    function createDeclaration() {
        var NewDeclaration = {
            room: room,
            declaredgame: null,
            skatcards: null,
            basic: null,
            extra: null,
            value: null,
            pickskat: null
        };

        DeclarationList.push(NewDeclaration);
    }

    function createGame() {
        var NewGame = {
            room: room,
            skatclick: false,
            canclick: false,
            hiddenextrapoints: false,
            first: null,
            firstmovepos: 'przodek',
            bidwinner: null,
            status: null,
            players: [],
            positions: []
        };

        GameList.push(NewGame);
    }

    function deleteGame(room) {
        var temp = [];
        for (var i = 0; i < GameList.length; i++) {
            if (GameList[i].room !== room) {
                temp.push(GameList[i]);
            }
        }
        GameList = temp;
    }

    function deleteBid(room) {
        var temp = [];
        for (var i = 0; i < BidList.length; i++) {
            if (BidList[i].room !== room) {
                temp.push(BidList[i]);
            }
        }
        BidList = temp;
    }

    function deleteDeclaration(room) {
        var temp = [];
        for (var i = 0; i < DeclarationList.length; i++) {
            if (DeclarationList[i].room !== room) {
                temp.push(DeclarationList[i]);
            }
        }
        DeclarationList = temp;
    }

    function getHalfCard(card) {
        var partofcard = card.split("/");
        var newcard = '<img src=/images/Cards/Half/' + partofcard[4] + '/' + partofcard[5];
        return newcard;
    }

    function getHalfGerCard(card) {
        card = toGermanSuit(card);
        var partofcard = card.split("/");
        var newcard = '<img src=/images/Cards/Half/' + partofcard[4] + '/' + partofcard[5];
        return newcard;
    }

    function toGermanSuit(card) {
        var partsofcards = card.split("/");
        var color = '';
        var id = '';
        var newcard = '';
        switch (partsofcards[4]) {
            case 'Clubs'   :
                color = 'Kreuz';
                break;
            case 'Spades'  :
                color = 'Grun';
                break;
            case 'Hearts'  :
                color = 'Herz';
                break;
            case 'Diamonds':
                color = 'Schell';
                break;
        }
        id = partsofcards[5].substring(partsofcards[5].indexOf("id"));
        newcard = '<img src=/images/Cards/All/' + color + '/' + id.charAt(3) + 'o' + color.charAt(0) + '.png ' + id;
        return newcard;
    }

    function toFrenchSuit(card) {
        var partsofcards = card.split("/");
        var color = '';
        var id = '';
        var newcard = '';
        switch (partsofcards[4]) {
            case 'Kreuz' :
                color = 'Clubs';
                break;
            case 'Grun'  :
                color = 'Spades';
                break;
            case 'Herz'  :
                color = 'Hearts';
                break;
            case 'Schell':
                color = 'Diamonds';
                break;
        }
        id = partsofcards[5].substring(partsofcards[5].indexOf("id"));
        newcard = '<img src=/images/Cards/All/' + color + '/' + id.charAt(3) + 'o' + color.charAt(0) + '.png ' + id;
        return newcard;
    }

    function getGermanSuits(cards) {
        var germancards = [];
        for (var i = 0; i < cards.length; i++) {
            germancards.push(toGermanSuit(cards[i]));
        }
        return germancards;
    }

    function redrawLastCard(pos) {
        if ($(pos).find('img').length > 0) {
            var id = $(pos).find('img:last-child').attr('id');
            var partofcards = $(pos).find('img:last-child').attr('src').split("/");
            var allcard = '<img src=/images/Cards/All/' + partofcards[4] + '/' + partofcards[5] + ' id=' + id + '>';
            $(pos).find('img:last-child').remove();
            $(pos).append(allcard);
        }
    }

    function appendBackCards() {
        $('.second-player-cards').empty();
        for (var i = 0; i < 9; i++) {
            $('.second-player-cards').append('<img src=/images/Cards/Half/back.png>');
        }
        $('.second-player-cards').append('<img src=/images/Cards/All/back.png>');
        $('.first-player-cards').empty();
        for (var i = 0; i < 9; i++) {
            $('.first-player-cards').append('<img src=/images/Cards/Half/back.png>');
        }
        $('.first-player-cards').append('<img src=/images/Cards/All/back.png>');
    }

    function sendStats(data) {
        $.ajax({
            type: "POST",
            url: 'http://inz.herokuapp.com/users/game/' + room,
            data: data,
            dataType: "json",
            success: function (data) {

            },
            error: function () {

            }
        });
    }

    function showCards(cards, position) {
        $(position).empty();
        for (var i = 0; i < cards.length - 1; i++) {
           if (suits === 'german') {
                $(position).append(getHalfGerCard(cards[i]));
            } else {
                $(position).append(getHalfCard(cards[i]));
            }
        }
        if (suits === 'german') {
            $(position).append(toGermanSuit(cards[9]));
        } else {
            $(position).append(cards[9]);
        }

    }

    function hideBackCard(login) {
        switch (login.trim()) {
            case $('.first-player-login').text().trim():
                $('.first-player-cards img:first-child').hide().remove();
                break;
            case $('.second-player-login').text().trim():
                $('.second-player-cards img:first-child').hide().remove();
                break;
        }
    }

    /*** Przygotowanie rozgrywki ***/
    socket.emit('check if can be in room', room);

    socket.on('access forbbiden', function () {
        window.open("http://inz.herokuapp.com/users/lobby/","_self");
    });


    socket.on('prepare game', function () {
        $('.mycards').empty();
        $('.first-player-cards').empty();
        $('.second-player-cards').empty();
        $('.first-card').empty();
        $('.second-card').empty();
        $('.third-card').empty();
        appendBackCards();
        closeAllModals();
        deleteBid(room);
        deleteDeclaration(room);
        deleteGame(room);
        createBid();
        createDeclaration();
        createGame();
    });

    socket.on('ask for cards suit', function () {
        socket.emit('send cards suit');
    });

    socket.on('set cards suit', function (mySuit) {
        suits = mySuit;
    });

    socket.on('pass players order', function (players, positions) {
        if (players[0].toString().trim() === $(".mylogin").text()){
            $(".first-player-login").text(players[1]);
            $(".second-player-login").text(players[2]);
            $(".mypos").text(positions[0]);
        }

        if (players[1].toString().trim() === $(".mylogin").text()) {
            $(".first-player-login").text(players[0]);
            $(".second-player-login").text(players[2]);
            $(".mypos").text(positions[1]);
        }

        if (players[2].toString().trim() === $(".mylogin").text()) {
            $(".first-player-login").text(players[0]);
            $(".second-player-login").text(players[1]);
            $(".mypos").text(positions[2]);
        }

        var objGame = getGameObj(room);
        objGame.players = players;
        objGame.positions = positions;
    });

    /*** Licytacja wartości deklaracji ***/

    $("#bid-modal").on('click', '.passbet', function () {
        var objBid = getBidObj(room);
        objBid.bet = "pass";
        bidmodalClose = true;
        $('#bid-modal').modal('hide');
        socket.emit('pass bid', room, $(".mypos").text());
    });

    $(".bidvalue").on('click', function () {
        var objBid = getBidObj(room);
        objBid.bet = $(this).text();
        if (objBid.bet !== null) bidmodalClose = true;
        $('#bid-modal').modal('hide');
        socket.emit('bid value', room, objBid.bet);
        objBid.bet = null;// bez tego użytkownik bedzie mogl zamknac okno bez wskazania wartosci gdy pokaze sie 2 raz. Zapamietana bedzie
        //ostatnia wartosc a w warunku jest null ;)
    });

    $('#bid-modal').on('hidden.bs.modal', function () {
        if(bidmodalClose === false){
            $("#bid-modal").modal('show');
        }else{
            bidmodalClose = false;
        }
    });

    /*** Licytacja potwierdzenie wartości ***/

    $("#confirm-bet").on('click', '.confirmpass', function () {
        var objBid = getBidObj(room);
        objBid.confirmbet = "pass";
        confirmbetClose = true;
        $('#confirm-bet').modal('hide');
        socket.emit('pass bid', room, $(".mypos").text());
    });

    $("#confirm-bet").on('click', '.confirmyes', function () {
        var objBid = getBidObj(room);
        objBid.confirmbet = "yes";
        confirmbetClose = true;
        $('#confirm-bet').modal('hide');
        socket.emit('confirm bid value', room);  //Przodek potwierdzil wartosc np 18 ? tak
        objBid.confirmbet = null;
    });

    $('#confirm-bet').on('hidden.bs.modal', function (){
        if(confirmbetClose === false){
            $("#confirm-bet").modal('show');
        }else{
            confirmbetClose = false;
        }
    });

    /*** Decyzja czy wziac 18 czy 3 passy ***/

    $("#ask-eighteen").on('click', '.yeseighteen', function () {
        askeighteenClose = true;
        $('#ask-eighteen').modal('hide');
        socket.emit('ask skat',room);
    });

    $("#ask-eighteen").on('click', '.noeighteen', function () {
        askeighteenClose = true;
       $('#ask-eighteen').modal('hide');
       socket.emit('three passes',room);
    });

    $('#ask-eighteen').on('hidden.bs.modal', function () {
        if (askeighteenClose === false) {
            $('#ask-eighteen').modal('show');
        } else {
            askeighteenClose = false;
        }
    });

    /*** Decyzja o wzięciu Skata ***/

    $(".pickskatyes").on('click', function () {
        var objDeclaration = getDeclarationObj(room);
        var objGame = getGameObj(room);
        for (var i = 0; i < objDeclaration.skatcards.length; i++) {
            if (suits === 'french') {
                $(".mycards").append(objDeclaration.skatcards[i]);
            } else {
                $(".mycards").append(toGermanSuit(objDeclaration.skatcards[i]));
            }
        }
        objDeclaration.skatcards = null;
        objDeclaration.pickskat = 'yes';
        askaboutskatClose = true;
        $('#ask-about-skat').modal('hide');
        $('.secondclass').hide();
        objGame.hiddenextrapoints = true;
        objGame.skatclick = true;
    });

    $(".pickskatno").on('click', function () {
        var objDeclaration = getDeclarationObj(room);
        objDeclaration.pickskat = 'no';
        askaboutskatClose = true;
        $('#ask-about-skat').modal('hide');
    });

    $('#ask-about-skat').on('hidden.bs.modal', function () {
        if(askaboutskatClose === false){
            $('#ask-about-skat').modal('show');
        }else{
            var objDeclaration = getDeclarationObj(room);
            if(objDeclaration.pickskat.trim() === 'no'){
                $('#game-declaration').modal('show');
            }
            askaboutskatClose = false;
        }
    });

    //wskazanie 2 kart do Skata
    $(".mycards").on('click', 'img', function (){
        var objDeclaration = getDeclarationObj(room);
        var objGame = getGameObj(room);
        var cards = objDeclaration.skatcards;
        if (objGame.skatclick === true) {
            if (cards === null) {
                var temp = [];
                temp[0] = $(this);
                objDeclaration.skatcards = temp;
                $(this).hide();
                $(this).remove();
            } else {
                if (cards.length === 1) {
                    $(this).hide();
                    $(this).remove();
                    cards.push($(this));
                    objDeclaration.skatcards = cards;
                }
                if (cards.length === 2){
                    objGame.skatclick = false;
                    $('#game-declaration').modal('show');
                }
            }
        }

        if (objGame.canclick === true) {
            var objDeclaration = getDeclarationObj(room);
            var objGame = getGameObj(room);
            var x = $(this).attr('id');//karta wskazana przez gracza z jego puli kart

            if (objGame.first !== null) {
                if (objDeclaration.declaredgame.trim() === 'clubs' ||
                    objDeclaration.declaredgame.trim() === 'spades' ||
                    objDeclaration.declaredgame.trim() === 'hearts' ||
                    objDeclaration.declaredgame.trim() === 'diamonds') {

                    if (objGame.first.charAt(0).trim() === 'J') { // znalazlo
                        if (searchJacks() === true || searchDeclaredColor() === true) {
                            if (x.charAt(0) === 'J' || x.charAt(1) === getDeclaredColor()) {
                                PlayerMoveReaction(this);
                            }
                        }else {
                            PlayerMoveReaction(this);
                        }
                    } else if (objGame.first.charAt(1).trim() === getDeclaredColor()) {
                        if (searchJacks() === true || searchDeclaredColor() === true) {
                            if (x.charAt(0) === 'J' || x.charAt(1) === getDeclaredColor()) {
                                PlayerMoveReaction(this);
                            }
                        }else {
                            PlayerMoveReaction(this);
                        }
                    } else if (objGame.first.charAt(1).trim() !== getDeclaredColor()) {
                        if (searchTheSameColor(objGame.first.charAt(1).trim()) === true) {
                            if (x.charAt(1) === objGame.first.charAt(1).trim() && x.charAt(0) !== 'J') {
                                PlayerMoveReaction(this);
                            }
                        } else {
                            PlayerMoveReaction(this);
                        }
                    }
                } else if (objDeclaration.declaredgame.trim() === 'grand'){
                    if (objGame.first.charAt(0).trim() === 'J') { // znalazlo dupka
                        if (searchJacks() === true) {
                            if (x.charAt(0) === 'J') {
                                PlayerMoveReaction(this);
                            }
                        }else {
                            PlayerMoveReaction(this);
                        }
                    } else if (searchTheSameColor(objGame.first.charAt(1).trim()) === true) {
                        if (x.charAt(1) === objGame.first.charAt(1).trim() && x.charAt(0) !== 'J'){
                            PlayerMoveReaction(this);
                        }
                    }else{
                        PlayerMoveReaction(this);
                    }
                } else if (objDeclaration.declaredgame.trim() === 'null' || objDeclaration.declaredgame.trim() === 'null ouvert') {
                    if (searchTheSameColorNull(objGame.first.charAt(1).trim()) === true) {
                        if (x.charAt(1) === objGame.first.charAt(1).trim()) {
                            PlayerMoveReaction(this);
                        }
                    } else {
                        PlayerMoveReaction(this);
                    }
                }
            } else {
                PlayerMoveReaction(this);
            }
        }
    });

    /*** Deklaracja gry ***/

    $("#declaredgame").on('click', function () {
        var objDeclaration = getDeclarationObj(room);
        var objGame = getGameObj(room);
        if ($('input[name=basic]:checked').val() !== undefined) {
            objDeclaration.basic = $('input[name=basic]:checked').val();
        }
        if (objGame.hiddenextrapoints === false) {
            if ($('input[name=extrapoint]:checked').val() !== undefined) {
                objDeclaration.extra = $('input[name=extrapoint]:checked').val();
            }
        }
        $('input[name=extrapoint]').removeAttr('checked');
        $('input[name=basic]').removeAttr('checked');
        if (objDeclaration.extra !== null) {
            if (objDeclaration.extra.trim() === 'ouvert') {
                showcards = true;
            }
        }
        if (objDeclaration.basic !== null) {
            gamedeclarationClose = true;
        }
        if(gamedeclarationClose === true) {
            var temp = objDeclaration.skatcards;
            var color = [];
            for (var i = 0; i < temp.length; i++) {
                color[i] = $(temp[i]).attr('id');
            }
            objDeclaration.skatcards = color;
            socket.emit('declared game', room, objDeclaration.skatcards, objDeclaration.basic, objDeclaration.extra, objDeclaration.pickskat);
            if (objDeclaration.basic.trim() === 'null ouvert') showcards = true;
            if (showcards === true) {
                socket.emit('show declarer cards', room, $('.mypos').text(), getMyCards());
            }
        }
        $('#game-declaration').modal('hide');
    });

    $('#game-declaration').on('hidden.bs.modal', function () {
        if(gamedeclarationClose === false) {
            $('#game-declaration').modal('show');
        }else{
            gamedeclarationClose = false;
        }
    });

    socket.on('bid', function (firstValue,secondValue,thirdValue, position) {
        if ($(".mypos").text() === position.trim()) $('#bid-modal').modal('show');
        if (thirdValue <= 264) {
            $(".st-btn").text(firstValue);
            $(".nd-btn").text(secondValue);
            $(".rd-btn").text(thirdValue);
        }
    });

    socket.on('ask bid', function (value, position) {
        if (position.trim() === $('.mypos').text()) {
            $(".askedvalue").text(value + "?");
            $('#confirm-bet').modal('show');
        }
    });

    socket.on('ask eighteen', function (winner) {
        if (winner.trim() === $('.mylogin').text()) {
            $('#ask-eighteen').modal('show');
        }
    });

    /*** Gra ***/

    socket.on('ask skat', function (login) {
        if ($('.mylogin').text() === login.toString().trim()) $("#ask-about-skat").modal('show');
    });

    socket.on('send cards', function (cards) {
        var objDeclaration = getDeclarationObj(room);
        if ($(".mypos").text() === "srodek") {
            cards.player2 = sortCards(cards.player2);
            if (suits !== 'german') {
                for (var i = 0; i < cards.player2.length; i++) {
                    $('.mycards').append(cards.player2[i]);
                }
            } else {
                var germancards = getGermanSuits(cards.player2);
                for (var i = 0; i < germancards.length; i++) {
                    $('.mycards').append(germancards[i]);
                }
            }
        }

        if ($(".mypos").text() === "zadek") {
            cards.player1 = sortCards(cards.player1);
            if (suits !== 'german') {
                for (var i = 0; i < cards.player1.length; i++) {
                    $('.mycards').append(cards.player1[i]);
                }
            } else {
                var germancards = getGermanSuits(cards.player1);
                for (var i = 0; i < germancards.length; i++) {
                    $('.mycards').append(germancards[i]);
                }
            }
        }

        if ($(".mypos").text() === "przodek") {
            cards.player3 = sortCards(cards.player3);
            if (suits !== 'german') {
                for (var i = 0; i < cards.player3.length; i++) {
                    $('.mycards').append(cards.player3[i]);
                }
            } else {
                var germancards = getGermanSuits(cards.player3);
                for (var i = 0; i < germancards.length; i++) {
                    $('.mycards').append(germancards[i]);
                }
            }
        }
        objDeclaration.skatcards = cards.skat;
    });

    socket.on('set game data', function (winner, val, basic, extra) {
        $('.bidwinner').text(winner);
        $('.gamevalue').text(val);
        var objDeclaration = getDeclarationObj(room);
        objDeclaration.declaredgame = basic;
        objDeclaration.value = val;
        objDeclaration.extra = extra;

        switch (basic) {
            case 'clubs':
                basic = 'trefl';
                break;
            case 'spades':
                basic = 'pik';
                break;
            case 'hearts':
                basic = 'kier';
                break;
            case 'diamonds':
                basic = 'karo';
                break;
        }

        if (extra !== null) {
            switch (extra) {
                case 'schneider':
                    extra = 'krawiec';
                    break;
                case 'schwarz':
                    extra = 'na czarno';
                    break;
                case 'ouvert':
                    extra = 'otwarta';
                    break;
            }
            basic += " " + extra;
        }
        $('.declared').text(basic);
    });

    socket.on('turn', function (position) {
        var objGame = getGameObj(room);
        $('.turn').text('kolej: ' + position);
        if ($('.mypos').text() === position){
            objGame.canclick = true;
        }
    });

    socket.on('send card', function (card, login) {
        if (suits === 'german') {
            card = toGermanSuit(card);
        }
        switch (login.trim()) {
            case $('.first-player-login').text().trim() :
                $('.first-card').append(card);
                break;
            case $('.second-player-login').text().trim() :
                $('.third-card').append(card);
                break;
        }
    });

    socket.on('clear table', function () {
        $('.first-card').empty();
        $('.second-card').empty();
        $('.third-card').empty();
        var objGame = getGameObj(room);
        objGame.first = null;
    });

    socket.on('first turn card', function (card, position) {
        var objGame = getGameObj(room);
        objGame.first = card;
        objGame.firstmovepos = position;
    });

    socket.on('show cards', function (login, cards) {
        switch (login.trim()) {
            case $('.first-player-login').text().trim() :
                showCards(cards, '.first-player-cards');
                break;
            case $('.second-player-login').text().trim() :
                showCards(cards, '.second-player-cards');
                break;
        }
    });

    socket.on('hide card', function (card, login) {
        var objDeclaration = getDeclarationObj(room);
        var objGame = getGameObj(room);

        if (objDeclaration.declaredgame === 'null ouvert' || objDeclaration.extra === 'ouvert') {
            if (objGame.bidwinner.trim() === $('.mylogin').text().trim()) {
                hideBackCard(login);
            } else {
                switch (login.trim()) {
                    case $('.first-player-login').text().trim():
                        if ($('.first-player-login').text().trim() === objGame.bidwinner.trim()) {
                            $('.first-player-cards img').each(function () {
                                if ($(this).attr('id') === $(card).attr('id')) {
                                    $(this).fadeOut(1200);
                                    $(this).remove();
                                    redrawLastCard('.first-player-cards');
                                    return false;//to break
                                }
                            });
                        } else {
                            $('.first-player-cards img:first-child').hide().remove();
                        }
                        break;
                    case $('.second-player-login').text().trim():
                        if ($('.second-player-login').text().trim() === objGame.bidwinner.trim()) {
                            $('.second-player-cards img').each(function () {
                                if ($(this).attr('id') === $(card).attr('id')) {
                                    $(this).fadeOut(1200);
                                    $(this).remove();
                                    redrawLastCard('.second-player-cards');
                                    return false;//to break
                                }
                            });
                        } else {
                            $('.second-player-cards img:first-child').hide().remove();
                        }
                        break;
                }
            }
        } else {
            hideBackCard(login);
        }
    });

    socket.on('game result', function (player, bidvalue, result, matadors, declarerpoints, value) {
         var objDeclaration = getDeclarationObj(room);
        if(objDeclaration.declaredgame.trim() === 'null' || objDeclaration.declaredgame.trim() === 'null ouvert'){
            $('.matadors-info').hide();
            $('.bidvalue-info').hide();
            $('.declarerpoints-info').hide();
        }else{
            $('.matadors-info').show();
            $('.bidvalue-info').show();
            $('.declarerpoints-info').show();
            $('.matadors').text(matadors);
            $('.bidvalue').text("Zadeklarowano " + bidvalue);
            $('.declarerpoints').text("Uzyskano " + declarerpoints);
        }

        $('.player').text(player);
        $('.result').text(result);
        $('.value').text(value);
        $('#results').modal('show');
    });

    socket.on('bid winner', function (login) {
        var objGame = getGameObj(room);
        objGame.bidwinner = login;
    });

    socket.on('update status', function (status) {
        //status czy wygrana gra czy przegrana - ważże przyzapisie punktów do bazy
        var objGame = getGameObj(room);
        objGame.status = status;
    });

    socket.on('send stats', function () {
        var objGame = getGameObj(room);
        var objDeclaration = getDeclarationObj(room);
        var data = {
            status: objGame.status,
            played: objDeclaration.declaredgame,
            declarer: objGame.bidwinner,
            declaration: objDeclaration.value
        };
        sendStats(data);
    });


    socket.on('three passes', function () {
        var objGame = getGameObj(room);
        var players = objGame.players;
        $('.f-player').text(players[0]);
        $('.s-player').text(players[1]);
        $('.t-player').text(players[2]);
        $('#passes').modal('show');
    });

    $('#passes').on('hidden.bs.modal', function () {
        if (closePass !== true) {
            $('#passes').modal('show');
        } else {
            closePass = false;
        }
    });

    $('.leavegame').on('click', function () {
        socket.emit('leave game', room, $('.mylogin').text());
        window.open("http://inz.herokuapp.com/users/lobby", "_self");
        closeResult = true;
        closePass = true;
    });

    $('.playanotherone').on('click', function () {
        socket.emit('another one', room, $('.mylogin').text());
        closeResult = true;
        closePass = true;
        $('#results').modal('hide');
        $('#passes').modal('hide');
    });

    $('#results').on('hidden.bs.modal', function () {
        if (closeResult !== true) {
            $('#results').modal('show');
        } else {
            closeResult = false;
        }
    });

    socket.on('leave message', function () {
        $('#leave').modal('show');
    });

    $('#leave').on('hidden.bs.modal', function () {
        if (closePass !== true) {
            $('#leave').modal('show');
        } else {
            closePass = false;
        }

    });

        /* Komputer */
        socket.on('computer pass', function (position){
            socket.emit('pass bid', room, position);
        });

    socket.on('computer confirm bid value', function (){
        socket.emit('confirm bid value', room);
    });

    socket.on('computer ask skat', function (){
        socket.emit('ask skat', room);
    });

    socket.on('computer declared game', function (skatcards, basic, extra, pickskat){
        socket.emit('declared game', room, skatcards, basic, extra, pickskat);
    });

    socket.on('update declared game', function (skatcards, basic, extra, pickskat){
        var objDeclaration = getDeclarationObj(room);
        objDeclaration.skatcards = skatcards;
        objDeclaration.basic = basic;
        objDeclaration.extra = extra;
        objDeclaration.pickskat = pickskat;
    });

    socket.on('computer show declarer cards', function (position, cards){
        socket.emit('show declarer cards', room, position, cards);
    });


});
