$(document).ready(function() {
    $( '#showcredits').click(function() {
        console.log("AAA");
        $('#credits').modal('show');
    });
    $( '#hidecredits').click(function() {
        $('#credits').modal('hide');
    });
});
