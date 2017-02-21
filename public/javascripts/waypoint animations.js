$(document).ready(function(){

    // hide our element on page load
      $('.section-heading').css('opacity', 0);

    $('.section-heading').waypoint(function() {
        $('.section-heading').addClass('fadeInDown');
    }, { offset: 'bottom-in-view' });

    $('#resanim').css('opacity', 0);

    $('#resanim').waypoint(function() {
        $('#resanim').addClass('fadeInUp');
    }, { offset: 'bottom-in-view' });

});