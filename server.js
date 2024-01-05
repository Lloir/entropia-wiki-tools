require('dotenv').config();
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const upload = multer({ dest: 'uploads/' });
const app = express();
const port = 3000;

// Set EJS as template engine
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    const html = fs.readFileSync(path.resolve(__dirname, 'user.html'), 'utf8');
    res.send(html);
});

app.post('/submitForm', upload.single('avatarFile'), async (req, res) => {
    const professions = [];
    const skills = [];
    let errors = [];
    let currentSection = "";

    // Parse the uploaded CSV file
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => {
            let row = Object.keys(data)[0];

            if (row === '[Skills]') {
                currentSection = 'skills';
            } else if (row === '[Professions]') {
                currentSection = 'professions';
            } else if (currentSection === 'skills') {
                skills.push(data);
            } else if (currentSection === 'professions') {
                professions.push(data);
            }
        })
        .on('error', (error) => errors.push(error))
        .on('end', async () => {
            if (errors.length) {
                return res.status(500).send({ message: 'Failed to parse CSV file.' });
            }

            // Post the parsed data to mediawiki
            await postData(skills, professions).catch(error => console.error(`Error in posting data: ${error.message}`));

            // Display the parsed data in two different tables for Professions and Skills
            fs.unlinkSync(req.file.path);  // delete the uploaded file
            res.render('csvTable', { professions: professions, skills: skills });
        });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

const postData = async (skills, professions) => {
    // now using the environment variables
    const url = process.env.API_URL;
    const botUsername = process.env.BOT_USERNAME;
    const botPassword = process.env.BOT_PASSWORD;

    // Login to get session cookies
    let response = await axios.post(url, { action: 'login', lgname: botUsername, lgpassword: botPassword, lgtoken: '', format: 'json' });
    const cookies = response.headers['set-cookie'];

    // Check if logged in
    if (response.data.login.result !== 'Success') {
        throw new Error('Failed to log in');
    }

    // Get edit token
    response = await axios.get(url, { params: { action: 'query', meta: 'tokens', format: 'json' }, headers: { Cookie: cookies } });
    const csrfToken = response.data.query.tokens.csrftoken;

    // EDIT User pages with professions and skills
    const username = botUsername.split('@')[0];
    let professionsText = '';
    professions.forEach(profession => {
        professionsText += `${profession.profession} - ${profession.category} - ${profession.value} \n`;
    });
    await axios.post(url, { action: 'edit', title: `User:${username}/Professions`, text: professionsText, token: csrfToken, format: 'json' }, { headers: { Cookie: cookies } });

    let skillsText = '';
    skills.forEach(skill => {
        skillsText += `${skill.skill} - ${skill.category} - ${skill.value} \n`;
    });
    await axios.post(url, { action: 'edit', title: `User:${username}/Skills`, text: skillsText, token: csrfToken, format: 'json' }, { headers: { Cookie: cookies } });
};
