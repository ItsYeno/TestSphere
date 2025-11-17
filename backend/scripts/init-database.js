const { sequelize } = require('../src/models');
const { Team, User, Project } = require('../src/models');

const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing TestSphere Database...');
    
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync all models
    await sequelize.sync({ force: true });
    console.log('✅ Database schema synchronized successfully.');

    // Seed initial data
    await seedInitialData();
    console.log('✅ Initial data seeded successfully.');

    console.log('🎉 TestSphere Database initialization completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
};

const seedInitialData = async () => {
  // Create Teams
  const teams = await Team.bulkCreate([
    {
      name: 'mobile',
      display_name: 'Mobile Testing Team',
      description: 'Team responsible for mobile application testing across iOS and Android platforms'
    },
    {
      name: 'web',
      display_name: 'Web Testing Team', 
      description: 'Team responsible for web application testing across multiple browsers'
    },
    {
      name: 'api',
      display_name: 'API Testing Team',
      description: 'Team responsible for API and backend services testing'
    }
  ]);

  console.log(`✅ Created ${teams.length} teams`);

  // Create Admin User
  const adminUser = await User.create({
    email: 'admin@mtn.com',
    password_hash: 'admin123', // Will be hashed by the model hook
    name: 'System Administrator',
    role: 'admin',
    team_id: teams[0].id // Assign to mobile team by default
  });

  // Create Sample Testers
  const testers = await User.bulkCreate([
    {
      email: 'mobile.tester@mtn.com',
      password_hash: 'tester123',
      name: 'Mobile QA Tester',
      role: 'tester',
      team_id: teams[0].id
    },
    {
      email: 'web.tester@mtn.com', 
      password_hash: 'tester123',
      name: 'Web QA Tester',
      role: 'tester',
      team_id: teams[1].id
    },
    {
      email: 'api.tester@mtn.com',
      password_hash: 'tester123',
      name: 'API QA Tester', 
      role: 'tester',
      team_id: teams[2].id
    },
    {
      email: 'viewer@mtn.com',
      password_hash: 'viewer123',
      name: 'Project Viewer',
      role: 'viewer', 
      team_id: teams[0].id
    }
  ]);

  console.log(`✅ Created ${testers.length + 1} users`);

  // Create Sample Projects
  const projects = await Project.bulkCreate([
    {
      name: 'MTN Mobile App',
      description: 'Main customer-facing mobile application for MTN services',
      repository_url: 'https://github.com/mtn/mobile-app',
      team_id: teams[0].id,
      created_by: adminUser.id
    },
    {
      name: 'MyMTN Portal',
      description: 'Customer self-service web portal for managing MTN accounts',
      repository_url: 'https://github.com/mtn/web-portal',
      team_id: teams[1].id,
      created_by: adminUser.id
    },
    {
      name: 'Payment Gateway API',
      description: 'Backend API services for payment processing and transactions',
      repository_url: 'https://github.com/mtn/payment-api',
      team_id: teams[2].id,
      created_by: adminUser.id
    },
    {
      name: 'AirTime Services',
      description: 'Mobile airtime purchase and management services',
      repository_url: 'https://github.com/mtn/airtime-services',
      team_id: teams[0].id,
      created_by: adminUser.id
    }
  ]);

  console.log(`✅ Created ${projects.length} projects`);
};

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;