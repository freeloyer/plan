const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const path = require('path');
const moment = require('moment');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/../bootstrap'));

const { Client } = require('pg')
const client = new Client({
    user: 'jia',
    database: 'postgres',
});
client.connect((err) => {
    if (err) {
        console.error('connection error', err.stack);
    } else {
        console.log('connected');
    }
});

app.get('/', function(req, res) {
	  res.sendFile(path.join(__dirname+'/../bootstrap/login.html'));
});
app.get('/login.html', function(req, res) {
	  res.sendFile(path.join(__dirname+'/../bootstrap/login.html'));
});
app.get('/main.html', function(req, res) {
	  res.sendFile(path.join(__dirname+'/../bootstrap/main.html'));
});

const user_table = 'test_users'
const plan_table = 'test_plans'

function isValidTimespan(timespan) {
    return timespan == 'day' || timespan == 'week' || timespan == 'month'
        || timespan == 'year'
}

// Check if the start_date is valid time string.
function isValidStartDate(timespan, start_date) {
    var date = moment(start_date, 'YYYY-MM-DD', true)
    if (!date.isValid()) {
        return {state: false, err_message: 'Invalid date.'}
    }

    if (timespan == 'week' && date.day() != 1) {
        return {state: false, err_message: 'Not Monday for weekly plan.'}
    }
    if (timespan == 'month' && date.date() != 1) {
        return {state: false,
                err_message: 'Not 1st of a month for monthly plan.'}
    }
    if (timespan == 'year' && (date.month() != 0 ||
                               date.date() != 1)) {
        return {state: false,
                err_message: 'Not 1st of a year for yearly plan.'}
    }

    return {state: true}
}

function genInsertPlanQuery(plan_obj) {
    var column_names = []
    var column_values = []

    const fields = [
        'user_id', 'plan_timespan', 'start_date',
        'plan_priority', 'plan_progress', 'content', 'repeated_until']
    fields.forEach(function(field) {
        if (plan_obj.hasOwnProperty(field)) {
            column_names.push(field)
            column_values.push(`'${plan_obj[field]}'`)
        }
    })
        
    return `
        INSERT INTO ${plan_table} (${column_names.join(', ')}) VALUES
        (${column_values.join(', ')}) RETURNING plan_id;`
}

function genSelectPlanQuery(plan_obj) {
    var select_conditions = []
    const fields = [
        'plan_id', 'user_id', 'plan_timespan', 'start_date',
        'plan_priority', 'plan_progress', 'content', 'repeated_until']
    fields.forEach(function(field) {
        if (plan_obj.hasOwnProperty(field)) {
            select_conditions.push(`${field} = '${plan_obj[field]}'`)
        }
    })
        
    return `
        SELECT * FROM ${plan_table} WHERE
        (${select_conditions.join(' AND ')});`
}

function genUpdatePlanQuery(plan_obj) {
    var conditions = []
    plan_obj.plan_ids.forEach(function(plan_id) {
        conditions.push(`plan_id = '${plan_id}'`)
    })

    var set_statements = []
    const fields = [
        'plan_timespan', 'start_date', 'plan_priority', 'plan_progress',
        'content', 'repeated_until']
    fields.forEach(function(field) {
        if (plan_obj.hasOwnProperty(field)) {
            set_statements.push(`${field} = '${plan_obj[field]}'`)
        }
    })
        
    return `
        UPDATE ${plan_table} SET ${set_statements.join(', ')}
        WHERE ${conditions.join(' OR ')};`
}

// Verify username and password.
app.get('/users/:user_id/password/:password', async function(req, res) {
    try {
        var result = await client.query(
            `SELECT password from ${user_table}
             WHERE user_id = '${req.params.user_id}';`)
        if (result.rows.length == 0) {
            res.send(JSON.stringify({
                state:false,
                err_message: 'The user does not exist. Please sign up.'}))
        } else if (result.rows[0].password != req.params.password) {
            res.send(JSON.stringify({
                state:false,
                err_message: 'The password is incorrect.'}))
        } else {
            res.send(JSON.stringify({state: true}))
        }
    } catch (err) {
        res.send(JSON.stringify({state: false, err_message: err.message}))
    }
})

// Create a new user with password.
app.post('/users', function(req, res) {
    if (!req.body.hasOwnProperty('user_id') ||
        !req.body.hasOwnProperty('password')) {
        res.send(JSON.stringify({
            state: false,
            err_message: 'Both user_id and password need to be specified'}))
    }
    // Check if a user already exists.
    var search_query = `
        SELECT 1 FROM ${user_table} WHERE user_id='${req.body.user_id}';`
    var insert_query = `
        INSERT INTO ${user_table} (user_id, password) VALUES
        ('${req.body.user_id}', '${req.body.password}');`
    client.query(search_query, (search_err, search_res) => {
        if (search_err) {
            res.send(JSON.stringify({
                state: false, err_message: search_err}))
        }
        else if (search_res.rows.length > 0) {
            // If the user_id already exists, notify frontend.
            res.send(JSON.stringify({
                state: false,
                err_message: `User id ${req.body.user_id} already exists.`}))
        } else {
            client.query(insert_query, (insert_err, insert_res) => {
                if (insert_err) {
                    res.send(JSON.stringify({
                        state: false, err_message: insert_err.message}))
                } else {
                    res.send(JSON.stringify({state: true}))
                }
            })
        }
    })
});

// Update password for a new user. TBD
app.put('/users/:user_id', function(req, res) {
});

// Create a plan for a new user.
app.post('/users/:user_id/plans', function(req, res) {
    req.body.user_id = req.params.user_id
    if (!req.body.hasOwnProperty('user_id') ||
        !req.body.hasOwnProperty('plan_timespan') ||
        !req.body.hasOwnProperty('start_date')) {
        res.send(JSON.stringify({
            state: false,
            err_message:
                'user_id, plan_timespan, start_date are all needed.'}))
        return
    }
    if (!isValidTimespan(req.body.plan_timespan)) {
        res.send(JSON.stringify({
            state:false, err_message: 'Invalid plan timespan.'}))
        return
    }
    var is_valid_start_date =
        isValidStartDate(req.body.plan_timespan, req.body.start_date)
    if (!is_valid_start_date.state) {
        res.send(JSON.stringify(is_valid_start_date))
        return
    }

    var insert_query = genInsertPlanQuery(req.body)
    client.query(insert_query, (insert_err, insert_res) => {
        if (insert_err) {
            res.send(JSON.stringify({
                state: false, err_message: insert_err.message}))
        } else {
            res.send(JSON.stringify({
                state: true,
                plan_id: insert_res.rows[0].plan_id}))
        }
    })
});

// Get all plans from a user fullfilling some condition, e.g., all plans
// from today.
app.get('/get_plans', function(req, res) {
    var select_query = genSelectPlanQuery(req.query)
    console.log(select_query)
    client.query(select_query, (select_err, select_res) => {
        if (select_err) {
            res.send(JSON.stringify({
                state: false, err_message: select_err.message}))
        } else {
            res.send(JSON.stringify({state: true, plans: select_res.rows}))
        }
    })
});

// Update a set of plans given a set of plan_ids.
app.put('/users/:user_id/plans/:plan_ids', async function(req, res) {
    var plan_ids = req.params.plan_ids.split(',')
    console.log(plan_ids)
    var equal_to_plan_id = []
    plan_ids.forEach(function(plan_id){
        equal_to_plan_id.push(`plan_id = '${plan_id}'`)
    })
    // Validate that plan_ids all belong to the right user_id.
    try {
        var result = await client.query(
            `SELECT user_id FROM ${plan_table}
             WHERE ${equal_to_plan_id.join(' OR ')};`)
        console.log(result)
        result.rows.forEach(function(row){
            if (row.user_id != req.params.user_id) {
                res.send(JSON.stringify({
                    state: false,
                    err_message:
                        `Not all plans belong to ${req.params.user_id}.`}))
            }
        })
    } catch (err) {
        res.send(JSON.stringify({state: false, err_message: err.message}))
        return
    }

    // Validate start_date.
    if (req.body.hasOwnProperty('start_date')) {
        var timespan
        if (req.body.hasOwnProperty('plan_timespan')) {
            timespan = req.body.plan_timespan
        } else {
            try {
                var result = await client.query(
                    `SELECT plan_timespan FROM ${plan_table}
                     WHERE ${equal_to_plan_id.join(' OR ')};`)
                timespan = result.rows[0].plan_timespan
                if (!result.rows.every(c => (c.plan_timespan === timespan))) {
                    res.send(JSON.stringify({
                        state: false,
                        err_message:
                            'The plans are not from the same timespan'}))
                    return
                }
            } catch (err) {
                res.send(JSON.stringify({
                    state: false, err_message: err.message}))
                return
            }
        }

        var is_valid_start_date =
            isValidStartDate(timespan, req.body.start_date)
        if (!is_valid_start_date.state) {
            res.send(JSON.stringify(is_valid_start_date))
            return
        }
    }

    try {
        req.body.plan_ids = plan_ids
        var update_query = genUpdatePlanQuery(req.body)
        var result = await client.query(update_query)
        res.send(JSON.stringify({state: true}))
    } catch (err) {
        res.send(JSON.stringify({state: false, err_message: err.message}))
    }
});

// Delete a set of plans given a set of plan_ids.
app.delete('/users/:user_id/plans/:plan_ids', async function(req, res) {
    // Validate if the plans all belong to this user.
    var plan_ids = req.params.plan_ids.split(',')
    var equal_to_plan_id = []
    plan_ids.forEach(function(plan_id){
        equal_to_plan_id.push(`plan_id = '${plan_id}'`)
    })
    // Validate that plan_ids all belong to the right user_id.
    try {
        var result = await client.query(
            `SELECT user_id FROM ${plan_table}
             WHERE ${equal_to_plan_id.join(' OR ')};`)
        if (!result.rows.every(row => row.user_id === req.params.user_id)) {
            res.send(JSON.stringify({
                state: false,
                err_message:
                    `Not all plans belong to ${req.params.user_id}.`}))
        }
    } catch (err) {
        res.send(JSON.stringify({state: false, err_message: err.message}))
        return
    }

    try {
        var result = await client.query(
            `DELETE FROM ${plan_table} WHERE ${equal_to_plan_id.join(' OR ')}`)
        res.send(JSON.stringify({state: true}))
    } catch (err) {
        res.send(JSON.stringify({state: false, err_message: err.message}))
    }
});

app.listen(8080);
console.log('Listening on port 8080...');
