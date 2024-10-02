const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

const db = mysql.createConnection({
    // 'NAME': 'spark_bank',
    //     'USER': 'root',
    //     'PASS': 'akash',
    //     'HOST': '127.0.0.1',
    //     'PORT': '3307'

    host: 'localhost',
    user: 'root',
    password: 'akash',
    database: 'healthcare_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to database');
});


app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};




// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { name, age, gender, address, phone, email } = req.body;
    const sql = 'INSERT INTO patients (name, age, gender, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [name, age, gender, address, phone, email], (err, result) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// app.get('/appointments', (req, res) => {
//     db.query('SELECT * FROM patients', (err, patients) => {
//         if (err) throw err;
//         res.render('appointments', { patients });
//     });
// });

app.get('/appointments', (req, res) => {
    db.query('SELECT * FROM patients', (err, patients) => {
        if (err) throw err;
        db.query('SELECT * FROM doctors', (err, doctors) => {
            if (err) throw err;
            const errorMessage = req.query.errorMessage || '';
            res.render('appointments', { patients, doctors, errorMessage });
        });
    });
});



// app.post('/appointments', (req, res) => {
//     const { patient_id, doctor_name, appointment_date, appointment_time } = req.body;
//     const sql = 'INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time) VALUES (?, ?, ?, ?)';
//     db.query(sql, [patient_id, doctor_name, appointment_date, appointment_time], (err, result) => {
//         if (err) throw err;
//         res.redirect('/');
//     });
// });

app.post('/appointments', (req, res) => {
    const { patient_id, doctor_name, appointment_date, appointment_time } = req.body;
    
    // Combine appointment_date and appointment_time into a single Date object
    const appointmentDateTime = new Date(`${appointment_date}T${appointment_time}`);
    const currentDateTime = new Date();

    // Check if the appointment date and time is in the past
    if (appointmentDateTime < currentDateTime) {
        return res.redirect(`/appointments?errorMessage=You cannot book an appointment in the past. Please choose a future time.`);
    }

    // SQL query to check if the doctor is already booked within the 45-minute window
    const checkSql = `
        SELECT * 
        FROM appointments 
        WHERE doctor_name = ? 
        AND appointment_date = ? 
        AND ABS(TIMESTAMPDIFF(MINUTE, CONCAT(appointment_date, ' ', appointment_time), CONCAT(?, ' ', ?))) < 45
    `;
    
    db.query(checkSql, [doctor_name, appointment_date, appointment_date, appointment_time], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            // If the doctor is already booked within the 45-minute window
            return res.redirect(`/appointments?errorMessage=The doctor is already booked within 45 minutes of this time. Please choose a different time.`);
        } else {
            // If the doctor is not booked within the 45-minute window, proceed with booking
            const sql = 'INSERT INTO appointments (patient_id, doctor_name, appointment_date, appointment_time) VALUES (?, ?, ?, ?)';
            db.query(sql, [patient_id, doctor_name, appointment_date, appointment_time], (err, result) => {
                if (err) throw err;
                res.redirect('/');
            });
        }
    });
});






app.get('/admin/login', (req, res) => {
    res.render('admin_login');
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'admin') { // Use secure method for real projects
        req.session.isAuthenticated = true;
        res.redirect('/admin/appointments');
    } else {
        res.send('Invalid credentials');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/admin/login');
});


app.get('/admin/appointments', (req, res) => {
    const sql = `
        SELECT 
            a.id, 
            p.name AS patient_name, 
            a.doctor_name, 
            a.appointment_date, 
            a.appointment_time 
        FROM 
            appointments a 
        JOIN 
            patients p 
        ON 
            a.patient_id = p.id
    `;
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('admin_appointments', { appointments: results });
    });
});

// Route to handle deletion of an appointment
app.post('/admin/appointments/delete/:id', (req, res) => {
    const appointmentId = req.params.id;
    const sql = 'DELETE FROM appointments WHERE id = ?';
    
    db.query(sql, [appointmentId], (err, result) => {
        if (err) throw err;
        res.redirect('/admin/appointments');
    });
});

// Route to display the doctors management page
app.get('/admin/doctors', (req, res) => {
    db.query('SELECT * FROM doctors', (err, doctors) => {
        if (err) throw err;
        res.render('admin_doctors', { doctors });
    });
});

// Route to handle adding a new doctor
app.post('/admin/doctors/add', (req, res) => {
    const { name, specialization } = req.body;
    const sql = 'INSERT INTO doctors (name, specialization) VALUES (?, ?)';
    db.query(sql, [name, specialization], (err, result) => {
        if (err) throw err;
        res.redirect('/admin/doctors');
    });
});

// Route to handle deleting a doctor
app.post('/admin/doctors/delete/:id', (req, res) => {
    const doctorId = req.params.id;
    const sql = 'DELETE FROM doctors WHERE id = ?';
    db.query(sql, [doctorId], (err, result) => {
        if (err) throw err;
        res.redirect('/admin/doctors');
    });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


