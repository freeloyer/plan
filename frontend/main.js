const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun','Jul', 'Aug', 'Sep',
                'Oct', 'Nov', 'Dec']
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
                  'Saturday']
const planRowHtmlTmpl =
    `<tr id=%1>
       <td><input type="checkbox" class="select-one"></td>
       <td><textarea type='text' rows='1' name='items' class='form-control'>%2</textarea></td>
	   <td>
         <div class='dropdown'>
           <button class='btn btn-outline-success waves-effect dropdown-toggle'
            type='button' data-toggle='dropdown'>%3</button>
		   <div class="dropdown-menu">
			 <a class="dropdown-item">Low</a>
		     <a class="dropdown-item">Medium</a>
			 <a class="dropdown-item">High</a>
		   </div>
		 </div> 
	   </td>
	   <td>
         <button type="button"
           class="%4 btn btn-outline-warning waves-effect">
           %5
         </button>
	   </td>
	   <td>
         <button type="button" class="close" aria-label="Close">
           <span aria-hidden="true">&times;</span>
         </button>
	   </td>
    </tr>`
const base_url = 'http://lioncathome.ddns.net:8080'

var user_id = localStorage.getItem('user_id')
var day_plan_date, week_plan_date, month_plan_date
var unsaved_plans_count = 0

function default_plan_setting() {
    return ['unsavedplan_' + unsaved_plans_count++, '',
            'Low', 'btn-finish', 'Finish']
}

function format(str, arr) {
    return str.replace(/%(\d+)/g, function(_,m) {
        return arr[--m]
    })
}

// TODO(siqiong); Add an alert modal for this.
function showAlert(err_message) {
    alert(err_message)
//    $('#alertcontent').empty()
//    $('#alertcontent').append('<p>'+data.err_message+'</p>')
//    $('#popalert').modal('show')
}

function loadAllPlans(timespan) {
    $('table.' + timespan + '-list > tbody').empty()
    // Load all daily plans from today.
    var start_date_str
    if (timespan === 'day') {
        // Show current date for day plan panel.
        var cur_day = weekdays[day_plan_date.day()];
        $("#current-day").html('<p>' + day_plan_date.format('YYYY-MM-DD') +
                               ', ' + cur_day + '</p>')
        start_date_str = day_plan_date.format('YYYY-MM-DD')
    } else if (timespan === 'week') {
        // Show current date for week plan panel.
        var monday = week_plan_date.format('YYYY-MM-DD')
        var sunday =
            moment(week_plan_date).endOf('isoWeek').format('YYYY-MM-DD')
        $("#current-" + timespan).html('<p>Monday(' + monday + ') - Sunday(' +
                                       sunday + ')</p>')
        start_date_str = week_plan_date.format('YYYY-MM-DD')
    } else {
        // Show current plan for month plan panel.
        $("#current-" + timespan).html(
            '<p>' + months[month_plan_date.month()] +
            ', ' + month_plan_date.year() + '</p>')
        start_date_str = month_plan_date.format('YYYY-MM-DD')
    }
    $.ajax({
        url: base_url+'/get_plans',
        data: {
            user_id: user_id,
            plan_timespan: timespan,
            start_date: start_date_str
        },
        dataType: 'json',
        success: function(data) {
            if (data.state) {
                data.plans.forEach(function(plan){
                    $('table.' + timespan + '-list > tbody')
                        .append(format(
                            planRowHtmlTmpl,
                            ['plan_' + plan.plan_id, plan.content,
                             plan.plan_priority,
                             plan.plan_progress ? 'btn-reopen' : 'btn-finish',
                             plan.plan_progress ? 'Reopen' : 'Finish']))
                     // If the plan is done, disable editing the row.
                     if (plan.plan_progress) {
                         var row = $('#plan_' + plan.plan_id)
                         row.find('textarea').attr('readonly', 'readonly')
                         row.find('.dropdown-toggle').prop('disabled', true)
                         row.find('.select-one').prop('disabled', true)
                     }
                })
            } else {
                showAlert(data.err_message)
            }
        },
        error: function(request, status, error) {
            showAlert(request.responseText)
        },
        type: 'GET'
    })
}

function updatePlans(plan_ids, updated_data) {
    $.ajax({
        url: base_url + '/users/' + user_id + '/plans/' + plan_ids.join(','),
        data: updated_data,
        dataType: 'json',
        success: function(data) {
            if (!data.state) {
                showAlert(data.err_message)
            }
        },
        error: function(request, status, error) {
            showAlert(request.responseText)
        },
        type: 'PUT'
    })
}

function createAPlan(cur_row) {
    var timespan = cur_row.parents('table').attr('id').split('-')[0]
    var progress = cur_row.find('btn-reopen').length > 0 ? 'True' : 'False'
    var start_date_str
    if (timespan === 'day') {
        start_date_str = day_plan_date.format('YYYY-MM-DD')
    } else if (timespan === 'week') {
        start_date_str = week_plan_date.format('YYYY-MM-DD')
    } else {
        start_date_str = month_plan_date.format('YYYY-MM-DD')
    }
    $.ajax({
        url: base_url + '/users/' + user_id + '/plans',
        data: {
            start_date: start_date_str,
            plan_timespan: timespan,
            plan_priority: cur_row.find('.dropdown-toggle').text(),
            plan_progress: progress,
            content: cur_row.find('textarea').val().replace("'", "''")
        },
        dataType: 'json',
        success: function(data) {
            if (data.state) {
                cur_row.attr('id', 'plan_' + data.plan_id)
            } else {
                showAlert(data.err_message)
            }
        },
        error: function(request, status, error) {
            showAlert(request.responseText)
        },
        type: 'POST'
    })
}

function deleteAPlan(cur_row) {
    var plan_type = cur_row.attr('id').split('_')[0]
    var plan_id = cur_row.attr('id').split('_')[1]
    if (plan_type === 'unsavedplan') {
        cur_row.remove()
        return
    }
    $.ajax({
        url: base_url + '/users/' + user_id + '/plans/' + plan_id,
        dataType: 'json',
        success: function(data) {
            if (data.state) {
                cur_row.remove()
            } else {
                showAlert(data.err_message)
            }
        },
        error: function(request, status, error) {
            showAlert(request.responseText)
        },
        type: 'DELETE'
    })
}

$(document).ready(function(){
    $('.welcome_line').text('Welcome ' + user_id)
    day_plan_date = moment()
    week_plan_date = moment().startOf('isoWeek')
    month_plan_date = moment().startOf('month')

    loadAllPlans('day')

    $('a[data-toggle="tab"]').on('show.bs.tab', function(){
        var target = $(this).attr("href")
        loadAllPlans(target.substr(1))
        $(target + ' textarea').each(function(row){
            $(this).height('auto')
            var height = row.prop('scrollHeight') - row.css('padding')[0]*2
            row.height(height)
        })
    })

	$("#addrow-day").on("click", function(){
        $('table.day-list > tbody').append(
            format(planRowHtmlTmpl, default_plan_setting()))
    })

	$("#addrow-week").on("click", function () {
        $('table.week-list > tbody').append(
            format(planRowHtmlTmpl, default_plan_setting()))
	})

	$("#addrow-month").on("click", function () {
        $('table.month-list > tbody').append(
            format(planRowHtmlTmpl, default_plan_setting()))
	})

    $('.btn-shift').on('click', function(){
        var table = $(this).parents('table')
        var timespan = table.prop('id').split('-')[0]
        var target_date = $(this).parent().siblings('input').val()

        if (timespan === 'week') {
            target_date =
                moment(target_date).startOf('isoWeek').format('YYYY-MM-DD')
        } else if (timespan === 'month') {
            target_date =
                moment(target_date).startOf('month').format('YYYY-MM-DD')
        }

        var selected_plan_ids = []
        table.find('.select-one.checked').each(function(){
            var plan_type = $(this).parents('tr').prop('id').split('_')[0]
            var plan_id = $(this).parents('tr').prop('id').split('_')[1]
            if (plan_type === "plan") {
                selected_plan_ids.push(plan_id)
            }
        })

        updatePlans(selected_plan_ids, {start_date: target_date})

        table.find('.select-one.checked').parents('tr').remove()
    })

  	var container=$('.bootstrap-iso form').length>0 ? $('.bootstrap-iso form').parent() : "body";
  	var options={
		format: 'yyyy-mm-dd',
		container: container,
		todayHighlight: true,
		autoclose: true,
  	};
  	$('#daily_date_input').datepicker(options);
  	$('#weekly_date_input').datepicker(options);
  	$('#monthly_date_input').datepicker(options);
})

$(document).on('click', 'button.close', function(){
    $('#delete_confirm_dialog').data('full_plan_id',
                                     $(this).parents('tr').attr('id'))
    $('#delete_confirm_dialog').modal('show')
})

$(document).on('click', 'button.btn-delete', function(){
    deleteAPlan($('#' + $('#delete_confirm_dialog').data('full_plan_id')))
    $('#delete_confirm_dialog').modal('hide')
})

$(document).on('click', 'a.dropdown-item', function(){
    $(this).parent().prev('.dropdown-toggle').text($(this).text())
    var plan_type = $(this).parents('tr').attr('id').split('_')[0]
    var plan_id = $(this).parents('tr').attr('id').split('_')[1]
    if (plan_type === 'plan') {
        updatePlans([plan_id], {plan_priority: $(this).text()})
    }
})

$(document).on('click', '.btn-finish', function(){
    var row = $(this).parents('tr')
    row.find('textarea').attr('readonly', 'readonly')
    row.find('.dropdown-toggle').prop('disabled', true)
    row.find('.select-one').prop('disabled', true)
    $(this).text('Reopen')
    $(this).removeClass('btn-finish')
    $(this).addClass('btn-reopen')
    var plan_type = $(this).parents('tr').attr('id').split('_')[0]
    var plan_id = $(this).parents('tr').attr('id').split('_')[1]
    if (plan_type === 'plan') {
        updatePlans([plan_id], {plan_progress: 'True'})
    }
})

$(document).on('click', '.btn-reopen', function(){
    var row = $(this).parents('tr')
    row.find('textarea').attr('readonly', false)
    row.find('.dropdown-toggle').prop('disabled', false)
    row.find('.select-one').prop('disabled', true)
    $(this).text('Finish')
    $(this).removeClass('btn-reopen')
    $(this).addClass('btn-finish')
    var plan_type = $(this).parents('tr').attr('id').split('_')[0]
    var plan_id = $(this).parents('tr').attr('id').split('_')[1]
    if (plan_type === 'plan') {
        updatePlans([plan_id], {plan_progress: 'False'})
    }
})

$(document).on('show change keyup keydown paste cut', 'textarea', function(e){
    $(this).height('auto')
    var height = $(this).prop('scrollHeight') - $(this).css('padding')[0]*2
    $(this).height(height)
})

$(document).on('focus', 'textarea', function(e){
    $(this).data('content', $(this).val())
})

$(document).on('blur', 'textarea', function(e){
    var cur_row = $(this).parents('tr')
    var plan_type = cur_row.attr('id').split('_')[0]
    var plan_id = cur_row.attr('id').split('_')[1]
    if ($(this).data('content') != $(this).val()) {
        if (plan_type === 'unsavedplan') {
            createAPlan(cur_row)
        } else {
            updatePlans([plan_id], {content: $(this).val().replace("'", "''")})
        }
    }
})

function setToPrevCycle(timespan) {
    if (timespan === 'day') {
        day_plan_date = day_plan_date.subtract(1, 'days')
    } else if (timespan === 'week') {
        week_plan_date = week_plan_date.subtract(7, 'days')
    } else {
        month_plan_date = month_plan_date.subtract(1, 'months').date(1)
    }
}

function setToNextCycle(timespan) {
    if (timespan === 'day') {
        day_plan_date = day_plan_date.add(1, 'days')
    } else if (timespan === 'week') {
        week_plan_date = week_plan_date.add(7, 'days')
    } else {
        month_plan_date = month_plan_date.add(1, 'months').date(1)
    }
}

$(document).on('click', 'a.prev', function(){
    var timespan = $(this).parents('.tab-pane').attr('id')
    setToPrevCycle(timespan)
    loadAllPlans(timespan)
})

$(document).on('click', 'a.next', function(){
    var timespan = $(this).parents('.tab-pane').attr('id')
    setToNextCycle(timespan)
    loadAllPlans(timespan)
})

$(document).on('click', '.select-all', function(){
    if (!$(this).prop('checked')) {
        $(this).prop('checked', false)
        $(this).removeClass('checked')
        $(this).parents('table').find('.select-one:not([disabled])')
            .removeClass('checked')
        $(this).parents('table').find('.select-one:not([disabled])')
            .prop('checked', false)
    } else {
        $(this).addClass('checked')
        $(this).prop('checked', true)
        $(this).parents('table').find('.select-one:not([disabled])')
            .addClass('checked')
        $(this).parents('table').find('.select-one:not([disabled])')
            .prop('checked', true)
    }
})

$(document).on('click', '.select-one', function(){
    if (!$(this).prop('checked')) {
        $(this).prop('checked', false)
        $(this).removeClass('checked')
    } else {
        $(this).addClass('checked')
        $(this).prop('checked', true)
    }
})
