const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });
const app = express();
const port = 3000;

// Set EJS as template engine
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    const html = fs.readFileSync(path.resolve(__dirname, 'user.html'), 'utf8');
    res.send(html);
});

app.post('/submitForm', upload.single('avatarFile'), (req, res) => {
    const results = [];
    let errors = [];
    let skillSum = 0;

    // Parse the uploaded CSV file
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            results.push(data);
            skillSum += Number(data.skill); // assumes "skill" is the name of your CSV column to sum up
        })
        .on('error', (error) => errors.push(error))
        .on('end', () => {
            if (errors.length) {
                return res.status(500).send({ message: 'Failed to parse CSV file.' });
            }

            // Display the parsed data in a table
            fs.unlinkSync(req.file.path);  // delete the uploaded file
            res.render('csvTable', { rows: results, skillSum: skillSum });
        });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
