import db from "./db/connection.js";

async function seedDatabase() {
  console.log("🌱 Starting database seeding...\n");

  try {
    // ============================================
    // 0. INSERT TESTS (if not exists)
    // ============================================
    console.log("📋 Checking/Inserting tests...");
    const [existingTests] = await db.query("SELECT * FROM tests LIMIT 1");
    if (existingTests.length === 0) {
      await db.query(
        `INSERT INTO tests (name, code, description, duration_minutes, sequence) VALUES (?, ?, ?, ?, ?)`,
        ['RIASEC Personality Test', 'RIASEC', 'Holland Code career interest assessment', 20, 1]
      );
      console.log("✅ Inserted test\n");
    } else {
      console.log("✅ Tests already exist\n");
    }

    // ============================================
    // 1. INSERT CAREERS (10 careers)
    // ============================================
    console.log("📊 Inserting careers...");
    const careers = [
      ['Software Architect', 'Design and develop complex software systems and applications using cutting-edge technologies', 'Tech • High Growth • Remote Friendly'],
      ['Data Scientist', 'Analyze complex data using machine learning and statistical methods to drive business decisions', 'Analytics • High Salary • Research'],
      ['Product Manager', 'Define product strategy, roadmap, and features for technology products and services', 'Leadership • Creative • Strategy'],
      ['UX/UI Designer', 'Create intuitive and beautiful user interfaces and engaging user experiences', 'IT • Problem Solving • Corporate'],
      ['Cybersecurity Analyst', 'Protect organizations from cyber threats, vulnerabilities, and security breaches', 'Security • Technical • Detail-Oriented'],
      ['Financial Analyst', 'Analyze financial data and market trends to guide business investment decisions', 'Finance • Math • Corporate'],
      ['Systems Analyst', 'Analyze business requirements and design IT solutions to improve processes', 'IT • Problem Solving • Corporate'],
      ['Digital Marketing Manager', 'Plan and execute comprehensive digital marketing strategies across multiple channels', 'Leadership • Creative • Strategy'],
      ['Mechanical Engineer', 'Design, develop, and test mechanical systems, equipment, and manufacturing processes', 'IT • Problem Solving • Corporate'],
      ['Content Writer', 'Create engaging and compelling written content for various platforms and audiences', 'IT • Problem Solving • Corporate']
    ];

    for (const career of careers) {
      await db.query(
        `INSERT INTO careers (name, description, category) VALUES (?, ?, ?)`,
        career
      );
    }
    console.log("✅ Inserted 10 careers\n");

    // ============================================
    // 2. INSERT COLLEGES (30 colleges)
    // ============================================
    console.log("🏫 Inserting colleges...");
    const colleges = [
      'IIT Bombay', 'IIT Delhi', 'IIT Madras', 'BITS Pilani', 'NIT Trichy',
      'IIIT Hyderabad', 'VIT Vellore', 'DTU Delhi', 'NSUT Delhi', 'Manipal Institute of Technology',
      'AIIMS Delhi', 'CMC Vellore', 'JIPMER Puducherry',
      'IIM Ahmedabad', 'IIM Bangalore', 'IIM Calcutta', 'XLRI Jamshedpur', 'FMS Delhi',
      'St. Stephens College', 'Miranda House', 'Loyola College', 'Christ University', 'ISI Kolkata', 'IISc Bangalore',
      'NID Ahmedabad', 'NIFT Delhi',
      'NLSIU Bangalore', 'NALSAR Hyderabad',
      'SRCC Delhi', 'LSR Delhi'
    ];

    for (const college of colleges) {
      await db.query(
        `INSERT INTO colleges (name) VALUES (?)`,
        [college]
      );
    }
    console.log("✅ Inserted 30 colleges\n");

    // ============================================
    // 3. INSERT QUESTIONS (30 questions for RIASEC)
    // ============================================
    console.log("❓ Inserting questions...");
    const questions = [
      // Realistic (5)
      ['I enjoy working with tools and machinery'],
      ['I like working outdoors with my hands'],
      ['I prefer practical tasks over theoretical discussions'],
      ['I enjoy building or repairing things'],
      ['I like working with mechanical equipment'],
      
      // Investigative (5)
      ['I enjoy solving complex problems'],
      ['I like conducting research and experiments'],
      ['I prefer analyzing data and information'],
      ['I enjoy learning about scientific concepts'],
      ['I like working independently on intellectual tasks'],
      
      // Artistic (5)
      ['I enjoy creative and artistic activities'],
      ['I like expressing myself through art or music'],
      ['I prefer unstructured and flexible work environments'],
      ['I enjoy designing or creating new things'],
      ['I like working on creative projects'],
      
      // Social (5)
      ['I enjoy helping and teaching others'],
      ['I like working in teams and groups'],
      ['I prefer jobs that involve caring for people'],
      ['I enjoy counseling or advising others'],
      ['I like organizing social events'],
      
      // Enterprising (5)
      ['I enjoy leading and persuading others'],
      ['I like taking on leadership roles'],
      ['I prefer competitive environments'],
      ['I enjoy selling products or ideas'],
      ['I like managing projects and people'],
      
      // Conventional (5)
      ['I enjoy working with detailed procedures'],
      ['I like organizing and maintaining records'],
      ['I prefer structured and orderly work'],
      ['I enjoy working with numbers and data'],
      ['I like following established guidelines']
    ];

    // First, get a test_id (assuming test_id=1 exists, or create one)
    const [[testRow]] = await db.query(`SELECT id FROM tests LIMIT 1`);
    const testId = testRow ? testRow.id : 1;

    const questionIds = [];
    for (const question of questions) {
      const [result] = await db.query(
        `INSERT INTO questions (test_id, question_text) VALUES (?, ?)`,
        [testId, question[0]]
      );
      questionIds.push(result.insertId);
    }
    console.log("✅ Inserted 30 questions\n");

    // ============================================
    // 4. INSERT OPTIONS (5 options per question)
    // ============================================
    console.log("📝 Inserting options...");
    const categories = [
      'Realistic', 'Realistic', 'Realistic', 'Realistic', 'Realistic',
      'Investigative', 'Investigative', 'Investigative', 'Investigative', 'Investigative',
      'Artistic', 'Artistic', 'Artistic', 'Artistic', 'Artistic',
      'Social', 'Social', 'Social', 'Social', 'Social',
      'Enterprising', 'Enterprising', 'Enterprising', 'Enterprising', 'Enterprising',
      'Conventional', 'Conventional', 'Conventional', 'Conventional', 'Conventional'
    ];

    const optionTexts = [
      'Strongly Disagree',
      'Disagree',
      'Neutral',
      'Agree',
      'Strongly Agree'
    ];

    let optionCount = 0;
    for (let i = 0; i < questionIds.length; i++) {
      const questionId = questionIds[i];
      const category = categories[i];
      
      for (let j = 0; j < 5; j++) {
        // Try to insert with category, if column doesn't exist, insert without it
        try {
          await db.query(
            `INSERT INTO options (question_id, option_text, score, category) VALUES (?, ?, ?, ?)`,
            [questionId, optionTexts[j], j + 1, category]
          );
        } catch (err) {
          // If category column doesn't exist, insert without it
          await db.query(
            `INSERT INTO options (question_id, option_text, score) VALUES (?, ?, ?)`,
            [questionId, optionTexts[j], j + 1]
          );
        }
        optionCount++;
      }
    }
    console.log(`✅ Inserted ${optionCount} options\n`);

    console.log("✨ Database seeding completed successfully!\n");
    console.log("Summary:");
    console.log("- 10 Careers");
    console.log("- 30 Colleges");
    console.log("- 30 Questions");
    console.log("- 150 Options");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();

