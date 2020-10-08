const { Op } = require("sequelize");
const Sequelize = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite3'
});

class Profile extends Sequelize.Model {

  /*
  Deposits money into the the the balance of a client, a client can't deposit more than 25% his total of jobs to pay. (at the deposit moment)
  */
  static async depositMoney(userId = null, data = null) {
    let job_price = 0;
    let deposit = 0;

    if (userId === null || data === null)
      throw new Error('Invalid userId or data')


    deposit = data['deposit'];
    const jobs = await Job.findAll({ where: { ContractId: userId } });

    if (jobs) {
      job_price = jobs.reduce((pre, v) => {
        pre += v['price'];
        return pre;
      }, 0);
    }

    if (deposit > (job_price * 1.25)) //over deposit
      throw new Error('Over deposit');

    const profile = await Profile.findOne({ where: { id: Number(userId) } });
    if (!profile)
      throw new Error('Profile not found with id ' + userId);

    profile.update({ balance: profile['balance'] + deposit });

    return profile;
  }
}
Profile.init(
  {
    firstName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    lastName: {
      type: Sequelize.STRING,
      allowNull: false
    },
    profession: {
      type: Sequelize.STRING,
      allowNull: false
    },
    balance: {
      type: Sequelize.DECIMAL(12, 2)
    },
    type: {
      type: Sequelize.ENUM('client', 'contractor')
    }
  },
  {
    sequelize,
    modelName: 'Profile'
  }
);

class Contract extends Sequelize.Model {
  /*
  find all of contracts only contain non terminated contracts.
  */
  static async findAllActive() {
    const contracts = await Contract.findAll({
      where: {
        [Op.or]: [
          { status: 'new' },
          { status: 'in_progress' }
        ]
      }
    });
    return contracts;
  }

  /*
  Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
  */
  static async bestProfession(start = null, end = null) {
    let max = 0;
    let contract_id;

    const contracts = await Contract.findAll({ where: { createdAt: { [Op.between]: [start, end] } } });
    if (!contracts)
      return;

    const contract_ids = contracts.map(item => item['id']);
    const jobs = await Job.findAll({
      attributes: [
        'ContractId',
        [sequelize.fn('sum', sequelize.col('price')), 'totalAmount'],
      ],
      group: ['ContractId'],
    });

    for (let job of jobs) {
      let totalAmount = job.getDataValue('totalAmount');
      if (totalAmount > max) {
        max = totalAmount;
        contract_id = job['ContractId']
      }
    }

    const contract = contracts.find(item => item.id === parseInt(contract_id));

    return contract;
  }

  /*
Returns the profession that earned the most money (sum of jobs paid) for any contactor that worked in the query time range.
*/
  static async bestClients(start = null, end = null) {
    let max = 0;
    let ids = [];
    let allJobs = [];

    const contracts = await Contract.findAll({ where: { createdAt: { [Op.between]: [start, end] } } });
    if (!contracts)
      return;

    const contract_ids = contracts.map(item => item['id']);
    const jobs = await Job.findAll({
      attributes: [
        'ContractId',
        [sequelize.fn('sum', sequelize.col('price')), 'paid'],
      ],
      group: ['ContractId'],
    });

    for (let job of jobs) {
      allJobs.push({ ContractId: job['ContractId'], paid: job['paid'] });
    }

    allJobs.sort((a, b) => Number(b.paid) - Number(a.paid));

    for (let j of allJobs) {
      let p = await Profile.findOne({ where: { id: j['ContractId'] } });
      j['fullName'] = `${p['firstName']} ${p['lastName']}`;
    }

    return allJobs;
  }

}
Contract.init(
  {
    terms: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    status: {
      type: Sequelize.ENUM('new', 'in_progress', 'terminated')
    }
  },
  {
    sequelize,
    modelName: 'Contract'
  }
);

class Job extends Sequelize.Model {

  /*
  Get all unpaid jobs for a user (either a client or contractor), for active contracts only.
  */
  static async unpaidJobsByUser(profile_id = null) {
    if (profile_id === null || profile_id === undefined)
      return;

    Profile.hasMany(Contract, { foreignKey: 'ContractorId' })
    Contract.belongsTo(Profile, { foreignKey: 'ContractorId' })

    const contracts = await Contract.findAll({ where: { ContractorId: profile_id } })
    if (!contracts)
      return;

    const contractIds = contracts.map(item => item['id']);
    const jobs = await Job.findAll({ where: { [Op.and]: [{ ContractId: [...contractIds] }, { paymentDate: null }] } });

    return jobs;
  }

  /*
  Pay for a job, a client can only pay if his balance >= the amount to pay. The amount should be moved from the client's balance to the contractor balance.
  */
  static async payForJob(jobId = null, data = null) {
    if (jobId === null || data === null)
      return;
    const { price, ContractorId } = data;

    const job = await Job.findOne({ where: { id: Number(jobId) } });
    if (!job || job['paid'] === true)
      throw new Error('invalid job or this job has been paid');

    const profile = await Profile.findOne({ where: { id: Number(ContractorId) } });
    if (!profile)
      throw new Error('Invalid profiile');

    if (profile['balance'] < price)
      throw new Error('Balance is too low');

    //make paymennt
    const paymentResult = await profile.update({ balance: profile['balance'] - price });
    if (!paymentResult)
      throw new Error('Payment failed');

    const results = await job.update({ paid: true });

    return results;
  }
}

Job.init(
  {
    description: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    price: {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: false
    },
    paid: {
      type: Sequelize.BOOLEAN,
      default: false
    },
    paymentDate: {
      type: Sequelize.DATE
    }
  },
  {
    sequelize,
    modelName: 'Job'
  }
);

Profile.hasMany(Contract, { as: 'Contractor', foreignKey: 'ContractorId' })
Contract.belongsTo(Profile, { as: 'Contractor' })
Profile.hasMany(Contract, { as: 'Client', foreignKey: 'ClientId' })
Contract.belongsTo(Profile, { as: 'Client' })
Contract.hasMany(Job)
Job.belongsTo(Contract)

module.exports = {
  sequelize,
  Profile,
  Contract,
  Job
};
