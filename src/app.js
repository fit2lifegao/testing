const express = require('express');
const {body, validationResult} = require('express-validator/check');
const bodyParser = require('body-parser');
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const { id } = req.params
    const contract = await Contract.findOne({ where: { id } })
    if (!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const contracts = await Contract.findAllActive()
    if (!contracts) return res.status(404).end()
    res.json(contracts)
})

app.get('/jobs/unpaid/:profile_id', getProfile, async (req, res) => {
    const { Job } = req.app.get('models')
    const { profile_id } = req.params;
    const jobs = await Job.unpaidJobsByUser(profile_id)
    if (!jobs) return res.status(404).end()
    res.json(jobs)
})

app.post('/jobs/:job_id/pay', [body('price').exists(), body('ContractorId').exists()],getProfile, async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty())
        return res.status(400).json({errors: errors.mapped()});

    const { Job } = req.app.get('models')
    const { job_id } = req.params;
    const { body } = req;

    Job.payForJob(job_id, body).then(data => {
        res.status(200).json({results:data});
    }).catch(error => {
        res.status(400).json({results: error});
    });
})

app.post('/balances/deposit/:userId', [body('deposit').exists()],getProfile, async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty())
        return res.status(400).json({errors: errors.mapped()});

    const { Profile } = req.app.get('models')
    const { userId } = req.params;
    const { body } = req;

    Profile.depositMoney(userId, body).then(data => {
        res.status(200).json({results:data});
    }).catch(error => {
        res.status(400).json({results: error});
    });
})

app.get('/admin/best-profession', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const { start, end } = req.query;

    if(start === undefined || end === undefined)
        return res.status(400).json({errors:'Invalid inputs'});

    const results = await Contract.bestProfession(start, end);

    if (!results) return res.status(404).end()
    res.json(results);
})

app.get('/admin/best-clients', getProfile, async (req, res) => {
    const { Contract } = req.app.get('models')
    const { start, end } = req.query;

    if(start === undefined || end === undefined)
        return res.status(400).json({errors:'Invalid inputs'});

    const results = await Contract.bestClients(start, end);

    if (!results) return res.status(404).end()
    res.json(results);
})


module.exports = app;
