var socket = io();
var data = [];
var RoomList = [];
var room = 'none';
var clicked = false;

$(document).ready(function(){

    socket.on('connect', function(){
        socket.emit('get rooms');
    });

    socket.on('rooms status', function(incomingRooms){
       $('.roomlist').empty();
        RoomList = incomingRooms;
        for(var i=0;i<RoomList.length;i++){
            if(RoomList[i].type.trim() === 'people'){
                $(".roomlist").append($('<div class="col-md-4 "><div class="well well-sm"><div class="inline"><span class="fa-stack fa-lg"><i class="fa fa-square fa-stack-2x text-green"></i><i class="fa fa-users fa-stack-1x fa-inverse"></i></span><p class="roomplace">' + RoomList[i].place + '/3</p><p class="roomnumber">' + RoomList[i].number + '</p></div></div></div>'));
            } else {
                $(".roomlist").append($('<div class="col-md-4 "><div class="well well-sm"><div class="inline"><span class="fa-stack fa-lg"><i class="fa fa-square fa-stack-2x text-bordo"></i><i class="fa fa-laptop fa-stack-1x fa-inverse"></i></span><p class="roomplace">' + RoomList[i].place + '/2</p><p class="roomnumber">' + RoomList[i].number + '</p></div></div></div>'));
            }
        }
    });

    $('.roomlist').on( 'click', ".well-sm", function(){
        if(clicked === false){
            room = $(this).find(".roomnumber").text();
            var objRoom = getRoomObj(room);
            if(objRoom.place < 3 ){
                clicked = true;
                socket.emit('take a sit', room);
            }
        }else{
            if(($(this).find(".roomnumber").text() === room)){
                socket.emit('stand');
                clicked = false;
                room = 'none';
            }
        }
    });

    socket.on('start game', function(room){
        window.open("http://skatinz.herokuapp.com/users/game/"+room,"_self");
    });

    function getRoomObj(room) {
        var obj;
        for (var i = 0; i < RoomList.length; i++) {
            obj = RoomList[i];
            if (obj.number === parseInt(room)){
                break;
            }
        }
        return obj;
    }
});
