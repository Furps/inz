var socket = io();
var data = [];
var room = 'none';
$(document).ready(function(){
    $('#acc-options-modal').modal('hide');
    $('#acc-stats-modal').modal('hide');

    socket.on('connect', function(){
        $('#messages').append($('<div class="panel panel-success"><div class="panel-body"><h3>Witaj</h3></div></div>'));
    });

    socket.on('chat message', function(login, msg, time){
           $('#messages').append($('<div class="panel panel-default"><div class="panel-body"><blockquote class="blockquote-reverse"><small><i class="fa fa-user" aria-hidden="true"></i> '+login+' <i class="fa fa-clock-o" aria-hidden="true"></i> '+time+'</small><p class="chatmessage">' + msg + '</p></blockquote></div></div>'));
        document.getElementById('messages').lastChild.scrollIntoView(false);
       });

    socket.on('my message', function(login, msg, time){
       $('#messages').append($('<div class="panel panel-default"><div class="panel-body"><blockquote><small><i class="fa fa-user" aria-hidden="true"></i> '+login+' <i class="fa fa-clock-o" aria-hidden="true"></i> '+time+'</small><p class="chatmessage">' + msg + '</p></blockquote></div></div>'));
        document.getElementById('messages').lastChild.scrollIntoView(false);
    });

    $('form').submit(function(){
        if($('#m').val().trim()!==""){
           var msg = $('#m').val();
            socket.emit('chat message', msg);
            $('#m').val('');
            return false;
        }
    });

    $( '#acc-options').on( 'click', function(){
        $('#acc-options-modal').modal('show');
    });

    $( '#acc-stats').on( 'click', function(){
        $('#acc-stats-modal').modal('show');
        $.ajax({
            type: "POST",
            url: 'https://inz.herokuapp.com/users/lobby',
            dataType: "json",
            success:function(data) {
                $(".error").hide();
                $(".success").show();
                $(".played").text(data.statistic.played);
                $(".won").text(data.statistic.won);
                $(".declared").text(data.statistic.declaration);
                $(".color").text(data.statistic.color);
                $(".grand").text(data.statistic.grand);
                $(".null").text(data.statistic.nullgame);
            },
            error:function() {
                $(".error h4" ).text("Nie udało się pobrać statystyk.");
                $(".error p" ).text("Spróbuj jeszcze raz.");
                $(".error").show();
                $(".success").hide();
            }
        });
    });

    $( '#frsuit').on( 'click', function(){
        $('#acc-options-modal').modal('hide');
        $.ajax({
            type: "POST",
            url: 'https://inz.herokuapp.com/users/suits',
            data: {suit:'french'},
            dataType: 'text'
        });
    });

    $( '#gersuit').on( 'click', function(){
        $('#acc-options-modal').modal('hide');
        $.ajax({
            type: "POST",
            url: 'https://inz.herokuapp.com/users/suits',
            data: {suit:'german'},
            dataType: 'text'
        });
    });

});

