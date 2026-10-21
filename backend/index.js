require('dotenv').config();
const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
);

// Helper: safely extract integer number from Neo4j values
function extractNumber(val, defaultVal = 0) {
  if (val === null || val === undefined) return defaultVal;
  if (neo4j.isInt(val)) return val.toNumber();
  if (typeof val === 'number') return val;
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

// Helper: convert Neo4j's wrapped integers/dates into plain JS values
function cleanProperties(props) {
  if (!props) return {};
  const cleaned = {};
  for (const key in props) {
    const value = props[key];
    if (neo4j.isInt(value)) {
      cleaned[key] = value.toNumber();
    } else if (value && typeof value === 'object' && value.year !== undefined) {
      cleaned[key] = value.toString();
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ===== GET ROUTES =====

// 1. Get all clubs with member & event counts
app.get('/api/clubs', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (c:Club)
      OPTIONAL MATCH (s:Student)-[:MEMBER_OF]->(c)
      OPTIONAL MATCH (c)-[:HOSTS]->(e:Event)
      RETURN c, count(DISTINCT s) AS member_count, count(DISTINCT e) AS event_count
      ORDER BY c.club_name ASC
    `);
    const clubs = result.records.map((record) => ({
      ...cleanProperties(record.get('c').properties),
      member_count: record.get('member_count').toNumber(),
      event_count: record.get('event_count').toNumber(),
    }));
    res.json(clubs);
  } catch (error) {
    console.error('Error fetching clubs:', error);
    res.status(500).json({ error: 'Failed to fetch clubs' });
  } finally {
    await session.close();
  }
});

// 2. Get single club details
app.get('/api/clubs/:id', async (req, res) => {
  const session = driver.session();
  try {
    const clubId = parseInt(req.params.id);
    if (isNaN(clubId)) {
      return res.status(400).json({ error: 'Invalid club ID' });
    }

    const result = await session.run(
      `
      MATCH (c:Club {club_id: $clubId})
      OPTIONAL MATCH (fa:FacultyAdvisor)-[:SUPERVISES]->(c)
      OPTIONAL MATCH (c)-[:HAS_BUDGET]->(cb:ClubBudget)
      OPTIONAL MATCH (s:Student)-[:MEMBER_OF]->(c)
      OPTIONAL MATCH (c)-[:HOSTS]->(e:Event)
      RETURN c,
             fa.advisor_name AS advisor_name,
             cb.allocated_amount AS allocated_budget,
             count(DISTINCT s) AS member_count,
             count(DISTINCT e) AS event_count
    `,
      { clubId }
    );

    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }

    const record = result.records[0];
    const budgetRaw = record.get('allocated_budget');
    const budget = budgetRaw
      ? neo4j.isInt(budgetRaw)
        ? budgetRaw.toNumber()
        : budgetRaw
      : 0;

    res.json({
      ...cleanProperties(record.get('c').properties),
      advisor_name: record.get('advisor_name') || 'None assigned',
      allocated_budget: budget,
      member_count: record.get('member_count').toNumber(),
      event_count: record.get('event_count').toNumber(),
    });
  } catch (error) {
    console.error('Error fetching club details:', error);
    res.status(500).json({ error: 'Failed to fetch club details' });
  } finally {
    await session.close();
  }
});

// 3. Get members of a specific club
app.get('/api/clubs/:id/members', async (req, res) => {
  const session = driver.session();
  try {
    const clubId = parseInt(req.params.id);
    if (isNaN(clubId)) {
      return res.status(400).json({ error: 'Invalid club ID' });
    }

    const result = await session.run(
      `
      MATCH (s:Student)-[r:MEMBER_OF]->(c:Club {club_id: $clubId})
      RETURN s, r.role_title AS role_title, r.join_date AS join_date
      ORDER BY r.role_title ASC, s.first_name ASC, s.last_name ASC
    `,
      { clubId }
    );

    const members = result.records.map((record) => ({
      ...cleanProperties(record.get('s').properties),
      role_title: record.get('role_title') || 'Member',
      join_date: record.get('join_date') ? record.get('join_date').toString() : null,
    }));
    res.json(members);
  } catch (error) {
    console.error('Error fetching club members:', error);
    res.status(500).json({ error: 'Failed to fetch club members' });
  } finally {
    await session.close();
  }
});

// 4. Get all students
app.get('/api/students', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (s:Student) RETURN s ORDER BY s.first_name ASC');
    const students = result.records.map((record) => cleanProperties(record.get('s').properties));
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  } finally {
    await session.close();
  }
});

// 5. Get single student details with club memberships and registered events
app.get('/api/students/:id', async (req, res) => {
  const session = driver.session();
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const result = await session.run(
      `MATCH (s:Student {student_id: $studentId})
       OPTIONAL MATCH (s)-[mr:MEMBER_OF]->(c:Club)
       OPTIONAL MATCH (s)-[rr:REGISTERED_FOR]->(e:Event)
       RETURN s,
              collect(DISTINCT { club_id: c.club_id, club_name: c.club_name, role_title: mr.role_title }) AS club_details,
              collect(DISTINCT c.club_name) AS clubs,
              collect(DISTINCT { event_id: e.event_id, title: e.title, attendance_status: rr.attendance_status }) AS event_details,
              collect(DISTINCT e.title) AS events`,
      { studentId }
    );
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const record = result.records[0];
    const rawClubs = record.get('clubs').filter(Boolean);
    const rawEvents = record.get('events').filter(Boolean);
    const clubDetails = (record.get('club_details') || [])
      .filter((cd) => cd && cd.club_name)
      .map((cd) => ({
        club_id: cd.club_id ? (neo4j.isInt(cd.club_id) ? cd.club_id.toNumber() : cd.club_id) : null,
        club_name: cd.club_name,
        role_title: cd.role_title || 'Member',
      }));
    const eventDetails = (record.get('event_details') || [])
      .filter((ed) => ed && ed.title)
      .map((ed) => ({
        event_id: ed.event_id ? (neo4j.isInt(ed.event_id) ? ed.event_id.toNumber() : ed.event_id) : null,
        title: ed.title,
        attendance_status: ed.attendance_status || 'Registered',
      }));

    res.json({
      ...cleanProperties(record.get('s').properties),
      clubs: rawClubs,
      events: rawEvents,
      club_details: clubDetails,
      event_details: eventDetails,
    });
  } catch (error) {
    console.error('Error fetching student detail:', error);
    res.status(500).json({ error: 'Failed to fetch student details' });
  } finally {
    await session.close();
  }
});

// 6. Get all events with hosting club, venue, capacity, and registration count
app.get('/api/events', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (c:Club)-[:HOSTS]->(e:Event)-[:HELD_AT]->(v:Venue)
      OPTIONAL MATCH (s:Student)-[:REGISTERED_FOR]->(e)
      RETURN e,
             c.club_id AS club_id,
             c.club_name AS club_name,
             v.venue_id AS venue_id,
             v.building_name AS venue_name,
             v.room_number AS room_number,
             v.max_capacity AS max_capacity,
             count(DISTINCT s) AS registered_count
      ORDER BY e.event_date DESC, e.title ASC
    `);
    const events = result.records.map((record) => {
      const capRaw = record.get('max_capacity');
      const maxCap = capRaw ? (neo4j.isInt(capRaw) ? capRaw.toNumber() : capRaw) : null;
      const cId = record.get('club_id');
      const vId = record.get('venue_id');

      return {
        ...cleanProperties(record.get('e').properties),
        club_id: cId ? (neo4j.isInt(cId) ? cId.toNumber() : cId) : null,
        club_name: record.get('club_name'),
        venue_id: vId ? (neo4j.isInt(vId) ? vId.toNumber() : vId) : null,
        venue_name: record.get('venue_name'),
        room_number: record.get('room_number'),
        max_capacity: maxCap,
        registered_count: record.get('registered_count').toNumber(),
      };
    });
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  } finally {
    await session.close();
  }
});

// 7. Get attendees/registrations for a specific event
app.get('/api/events/:id/attendees', async (req, res) => {
  const session = driver.session();
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    const result = await session.run(
      `
      MATCH (s:Student)-[r:REGISTERED_FOR]->(e:Event {event_id: $eventId})
      RETURN s, r.attendance_status AS attendance_status, r.registered_at AS registered_at
      ORDER BY s.first_name ASC, s.last_name ASC
    `,
      { eventId }
    );

    const attendees = result.records.map((record) => ({
      ...cleanProperties(record.get('s').properties),
      attendance_status: record.get('attendance_status') || 'Registered',
      registered_at: record.get('registered_at') ? record.get('registered_at').toString() : null,
    }));
    res.json(attendees);
  } catch (error) {
    console.error('Error fetching event attendees:', error);
    res.status(500).json({ error: 'Failed to fetch event attendees' });
  } finally {
    await session.close();
  }
});

// Alias for event registrations
app.get('/api/events/:id/registrations', (req, res) => {
  res.redirect(307, `/api/events/${req.params.id}/attendees`);
});

// 8. Get all venues
app.get('/api/venues', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (v:Venue) RETURN v ORDER BY v.building_name ASC');
    const venues = result.records.map((record) => cleanProperties(record.get('v').properties));
    res.json(venues);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  } finally {
    await session.close();
  }
});

// 9. Full graph data for visualization
app.get('/api/graph', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (n)-[r]->(m)
      RETURN n, r, m
      LIMIT 120
    `);

    const nodesMap = new Map();
    const links = [];

    result.records.forEach((record) => {
      const n = record.get('n');
      const m = record.get('m');
      const r = record.get('r');

      [n, m].forEach((node) => {
        const id = node.identity.toString();
        if (!nodesMap.has(id)) {
          const label = node.labels[0];
          const nameField = node.properties.first_name
            ? `${node.properties.first_name || ''} ${node.properties.last_name || ''}`.trim()
            : node.properties.title ||
              node.properties.club_name ||
              node.properties.building_name ||
              node.properties.company_name ||
              node.properties.item_name ||
              node.properties.advisor_name ||
              label;
          nodesMap.set(id, { id, label, name: nameField });
        }
      });

      links.push({
        source: n.identity.toString(),
        target: m.identity.toString(),
        type: r.type,
      });
    });

    res.json({ nodes: Array.from(nodesMap.values()), links });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ error: 'Failed to fetch graph data' });
  } finally {
    await session.close();
  }
});

// ===== POST ROUTES (Create new data) =====

// 10. Register a student for an event
// Checks capacity limit, validates input, prevents duplicate registrations
app.post('/api/register', async (req, res) => {
  const session = driver.session();
  try {
    const {
      student_id,
      event_id,
      attendance_status,
      first_name,
      last_name,
      email,
      phone,
      department,
      academic_year,
    } = req.body;

    const eventId = parseInt(event_id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event_id is required' });
    }

    // A. Check if Event exists & check capacity
    const eventCheck = await session.run(
      `
      MATCH (e:Event {event_id: $eventId})
      OPTIONAL MATCH (e)-[:HELD_AT]->(v:Venue)
      OPTIONAL MATCH (s:Student)-[:REGISTERED_FOR]->(e)
      RETURN e, v.building_name AS venue_name, v.max_capacity AS max_capacity, count(DISTINCT s) AS current_registrations
    `,
      { eventId }
    );

    if (eventCheck.records.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventRecord = eventCheck.records[0];
    const eventProps = cleanProperties(eventRecord.get('e').properties);
    const eventTitle = eventProps.title || 'Event';
    const capRaw = eventRecord.get('max_capacity');
    const maxCapacity = capRaw ? (neo4j.isInt(capRaw) ? capRaw.toNumber() : capRaw) : null;
    const currentRegistrations = eventRecord.get('current_registrations').toNumber();

    if (maxCapacity && currentRegistrations >= maxCapacity) {
      return res.status(400).json({
        error: `Registration closed: "${eventTitle}" has reached its maximum venue capacity (${maxCapacity} attendees).`,
      });
    }

    // B. Resolve student: either by student_id or create/find by email
    let studentId = parseInt(student_id);
    let studentProps = null;

    if (isNaN(studentId)) {
      // Create or find by email
      if (!email || !first_name) {
        return res.status(400).json({
          error: 'Either a valid student_id or student details (first_name, email) are required',
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address format' });
      }

      const existingStudentRes = await session.run(
        'MATCH (s:Student {email: $email}) RETURN s',
        { email: email.trim().toLowerCase() }
      );

      if (existingStudentRes.records.length > 0) {
        studentProps = cleanProperties(existingStudentRes.records[0].get('s').properties);
        studentId = studentProps.student_id;
      } else {
        // Create new student
        const idResult = await session.run('MATCH (s:Student) RETURN max(s.student_id) AS maxId');
        studentId = extractNumber(idResult.records[0]?.get('maxId')) + 1;
        const newStudentRes = await session.run(
          `CREATE (s:Student {
             student_id: $studentId,
             first_name: $firstName,
             last_name: $lastName,
             email: $email,
             phone: $phone,
             department: $department,
             academic_year: $academicYear
           })
           RETURN s`,
          {
            studentId,
            firstName: first_name.trim(),
            lastName: (last_name || '').trim(),
            email: email.trim().toLowerCase(),
            phone: (phone || '').trim(),
            department: (department || 'General').trim(),
            academicYear: (academic_year || '1st Year').trim(),
          }
        );
        studentProps = cleanProperties(newStudentRes.records[0].get('s').properties);
      }
    } else {
      const studentRes = await session.run(
        'MATCH (s:Student {student_id: $studentId}) RETURN s',
        { studentId }
      );
      if (studentRes.records.length === 0) {
        return res.status(404).json({ error: 'Student not found. Please verify the student ID.' });
      }
      studentProps = cleanProperties(studentRes.records[0].get('s').properties);
    }

    // C. Prevent Duplicate Registration
    const dupCheck = await session.run(
      `
      MATCH (s:Student {student_id: $studentId})-[r:REGISTERED_FOR]->(e:Event {event_id: $eventId})
      RETURN r
    `,
      { studentId, eventId }
    );

    if (dupCheck.records.length > 0) {
      return res.status(409).json({
        error: `${studentProps.first_name} ${studentProps.last_name} is already registered for "${eventTitle}".`,
      });
    }

    // D. Persist registration relationship in Neo4j
    const status = attendance_status || 'Registered';
    await session.run(
      `
      MATCH (s:Student {student_id: $studentId}), (e:Event {event_id: $eventId})
      CREATE (s)-[r:REGISTERED_FOR {attendance_status: $status, registered_at: datetime()}]->(e)
      RETURN s, e, r
    `,
      { studentId, eventId, status }
    );

    res.status(201).json({
      success: true,
      message: `Successfully registered ${studentProps.first_name} ${studentProps.last_name} for "${eventTitle}".`,
      student: studentProps,
      event: eventProps,
      attendance_status: status,
    });
  } catch (error) {
    console.error('Error during event registration:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  } finally {
    await session.close();
  }
});

// 11. Add a Club Member
// Adds student to club roster with role and join_date, preventing duplicate memberships
app.post('/api/clubs/:id/members', async (req, res) => {
  const session = driver.session();
  try {
    const clubId = parseInt(req.params.id);
    const {
      student_id,
      role_title,
      join_date,
      first_name,
      last_name,
      email,
      phone,
      department,
      academic_year,
    } = req.body;

    if (isNaN(clubId)) {
      return res.status(400).json({ error: 'Valid club ID is required' });
    }

    // A. Check if Club exists
    const clubCheck = await session.run('MATCH (c:Club {club_id: $clubId}) RETURN c', { clubId });
    if (clubCheck.records.length === 0) {
      return res.status(404).json({ error: 'Club not found' });
    }
    const clubProps = cleanProperties(clubCheck.records[0].get('c').properties);

    // B. Resolve Student (existing ID or lookup/create by email)
    let studentId = parseInt(student_id);
    let studentProps = null;

    if (isNaN(studentId)) {
      if (!email || !first_name) {
        return res.status(400).json({
          error: 'Either a valid student_id or student details (first_name, email) are required',
        });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid email address format' });
      }

      const existingStudentRes = await session.run(
        'MATCH (s:Student {email: $email}) RETURN s',
        { email: email.trim().toLowerCase() }
      );

      if (existingStudentRes.records.length > 0) {
        studentProps = cleanProperties(existingStudentRes.records[0].get('s').properties);
        studentId = studentProps.student_id;
      } else {
        const idResult = await session.run('MATCH (s:Student) RETURN max(s.student_id) AS maxId');
        studentId = extractNumber(idResult.records[0]?.get('maxId')) + 1;
        const newStudentRes = await session.run(
          `CREATE (s:Student {
             student_id: $studentId,
             first_name: $firstName,
             last_name: $lastName,
             email: $email,
             phone: $phone,
             department: $department,
             academic_year: $academicYear
           })
           RETURN s`,
          {
            studentId,
            firstName: first_name.trim(),
            lastName: (last_name || '').trim(),
            email: email.trim().toLowerCase(),
            phone: (phone || '').trim(),
            department: (department || 'General').trim(),
            academicYear: (academic_year || '1st Year').trim(),
          }
        );
        studentProps = cleanProperties(newStudentRes.records[0].get('s').properties);
      }
    } else {
      const studentRes = await session.run(
        'MATCH (s:Student {student_id: $studentId}) RETURN s',
        { studentId }
      );
      if (studentRes.records.length === 0) {
        return res.status(404).json({ error: 'Student not found. Please verify the student ID.' });
      }
      studentProps = cleanProperties(studentRes.records[0].get('s').properties);
    }

    // C. Prevent Duplicate Membership
    const dupCheck = await session.run(
      `
      MATCH (s:Student {student_id: $studentId})-[r:MEMBER_OF]->(c:Club {club_id: $clubId})
      RETURN r.role_title AS role_title
    `,
      { studentId, clubId }
    );

    if (dupCheck.records.length > 0) {
      const existingRole = dupCheck.records[0].get('role_title') || 'Member';
      return res.status(409).json({
        error: `${studentProps.first_name} ${studentProps.last_name} is already a member of "${clubProps.club_name}" (Role: ${existingRole}).`,
      });
    }

    // D. Persist membership in Neo4j
    const assignedRole = (role_title && role_title.trim()) || 'Member';
    const dateVal = (join_date && join_date.trim()) || new Date().toISOString().split('T')[0];

    await session.run(
      `
      MATCH (s:Student {student_id: $studentId}), (c:Club {club_id: $clubId})
      CREATE (s)-[r:MEMBER_OF {role_title: $assignedRole, join_date: date($dateVal)}]->(c)
      RETURN s, c, r
    `,
      { studentId, clubId, assignedRole, dateVal }
    );

    res.status(201).json({
      success: true,
      message: `Successfully added ${studentProps.first_name} ${studentProps.last_name} as ${assignedRole} of ${clubProps.club_name}.`,
      member: {
        ...studentProps,
        role_title: assignedRole,
        join_date: dateVal,
      },
    });
  } catch (error) {
    console.error('Error adding club member:', error);
    res.status(500).json({ error: 'Failed to add club member: ' + error.message });
  } finally {
    await session.close();
  }
});

// Alias: POST /api/members { club_id, student_id, ... }
app.post('/api/members', (req, res) => {
  const clubId = req.body.club_id;
  if (!clubId) {
    return res.status(400).json({ error: 'club_id is required' });
  }
  req.params.id = clubId;
  app._router.handle(req, res);
});

// 12. Create a new Club
app.post('/api/clubs', async (req, res) => {
  const session = driver.session();
  try {
    const { club_name, category, founded_date } = req.body;
    if (!club_name || !category || !founded_date) {
      return res.status(400).json({ error: 'club_name, category, and founded_date are required' });
    }

    const idResult = await session.run('MATCH (c:Club) RETURN max(c.club_id) AS maxId');
    const nextId = extractNumber(idResult.records[0]?.get('maxId')) + 1;
    const result = await session.run(
      `CREATE (c:Club {club_id: $clubId, club_name: $clubName, category: $category, founded_date: date($foundedDate)})
       RETURN c`,
      { clubId: nextId, clubName: club_name.trim(), category: category.trim(), foundedDate: founded_date.trim() }
    );
    const created = cleanProperties(result.records[0].get('c').properties);
    res.status(201).json({ ...created, member_count: 0, event_count: 0 });
  } catch (error) {
    console.error('Error creating club:', error);
    res.status(500).json({ error: 'Failed to create club' });
  } finally {
    await session.close();
  }
});

// 13. Create a new Student
app.post('/api/students', async (req, res) => {
  const session = driver.session();
  try {
    const { first_name, last_name, email, phone, department, academic_year } = req.body;
    if (!first_name || !email) {
      return res.status(400).json({ error: 'first_name and email are required' });
    }

    const idResult = await session.run('MATCH (s:Student) RETURN max(s.student_id) AS maxId');
    const nextId = extractNumber(idResult.records[0]?.get('maxId')) + 1;
    const result = await session.run(
      `CREATE (s:Student {student_id: $studentId, first_name: $firstName, last_name: $lastName,
               email: $email, phone: $phone, department: $department, academic_year: $academicYear})
       RETURN s`,
      {
        studentId: nextId,
        firstName: first_name.trim(),
        lastName: (last_name || '').trim(),
        email: email.trim().toLowerCase(),
        phone: (phone || '').trim(),
        department: (department || 'General').trim(),
        academicYear: (academic_year || '1st Year').trim(),
      }
    );
    res.status(201).json(cleanProperties(result.records[0].get('s').properties));
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Failed to create student' });
  } finally {
    await session.close();
  }
});

// 14. Create a new Event
app.post('/api/events', async (req, res) => {
  const session = driver.session();
  try {
    const {
      title,
      event_type,
      event_date,
      start_time,
      end_time,
      event_budget,
      club_id,
      venue_id,
    } = req.body;

    if (!title || !event_type || !event_date || !start_time || !end_time || !club_id || !venue_id) {
      return res.status(400).json({ error: 'All fields including club and venue are required' });
    }

    const idResult = await session.run('MATCH (e:Event) RETURN max(e.event_id) AS maxId');
    const nextId = extractNumber(idResult.records[0]?.get('maxId')) + 1;
    const result = await session.run(
      `MATCH (c:Club {club_id: $clubId}), (v:Venue {venue_id: $venueId})
       CREATE (e:Event {event_id: $eventId, title: $title, event_type: $eventType,
               event_date: date($eventDate), start_time: datetime($startTime),
               end_time: datetime($endTime), event_budget: $eventBudget})
       CREATE (c)-[:HOSTS]->(e)
       CREATE (e)-[:HELD_AT]->(v)
       RETURN e, c.club_name AS club_name, v.building_name AS venue_name, v.room_number AS room_number, v.max_capacity AS max_capacity`,
      {
        eventId: nextId,
        title: title.trim(),
        eventType: event_type.trim(),
        eventDate: event_date.trim(),
        startTime: start_time.trim(),
        endTime: end_time.trim(),
        eventBudget: parseFloat(event_budget) || 0,
        clubId: parseInt(club_id),
        venueId: parseInt(venue_id),
      }
    );
    if (result.records.length === 0) {
      return res.status(400).json({ error: 'Invalid club_id or venue_id' });
    }
    const record = result.records[0];
    const capRaw = record.get('max_capacity');
    res.status(201).json({
      ...cleanProperties(record.get('e').properties),
      club_id: parseInt(club_id),
      club_name: record.get('club_name'),
      venue_id: parseInt(venue_id),
      venue_name: record.get('venue_name'),
      room_number: record.get('room_number'),
      max_capacity: capRaw ? (neo4j.isInt(capRaw) ? capRaw.toNumber() : capRaw) : null,
      registered_count: 0,
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event: ' + error.message });
  } finally {
    await session.close();
  }
});

// ===== DELETE ROUTES =====

// 15. Delete Club Member
app.delete('/api/clubs/:clubId/members/:studentId', async (req, res) => {
  const session = driver.session();
  try {
    const clubId = parseInt(req.params.clubId);
    const studentId = parseInt(req.params.studentId);
    if (isNaN(clubId) || isNaN(studentId)) {
      return res.status(400).json({ error: 'Valid clubId and studentId are required' });
    }

    const result = await session.run(
      `
      MATCH (s:Student {student_id: $studentId})-[r:MEMBER_OF]->(c:Club {club_id: $clubId})
      DELETE r
      RETURN count(r) AS deletedCount
    `,
      { clubId, studentId }
    );

    res.json({ success: true, message: 'Membership removed successfully' });
  } catch (error) {
    console.error('Error removing club member:', error);
    res.status(500).json({ error: 'Failed to remove club member' });
  } finally {
    await session.close();
  }
});

// 16. Delete Event Registration / Attendee
app.delete('/api/events/:eventId/attendees/:studentId', async (req, res) => {
  const session = driver.session();
  try {
    const eventId = parseInt(req.params.eventId);
    const studentId = parseInt(req.params.studentId);
    if (isNaN(eventId) || isNaN(studentId)) {
      return res.status(400).json({ error: 'Valid eventId and studentId are required' });
    }

    await session.run(
      `
      MATCH (s:Student {student_id: $studentId})-[r:REGISTERED_FOR]->(e:Event {event_id: $eventId})
      DELETE r
      RETURN count(r) AS deletedCount
    `,
      { eventId, studentId }
    );

    res.json({ success: true, message: 'Event registration cancelled successfully' });
  } catch (error) {
    console.error('Error removing attendee:', error);
    res.status(500).json({ error: 'Failed to remove attendee' });
  } finally {
    await session.close();
  }
});

// 17. Delete Club
app.delete('/api/clubs/:id', async (req, res) => {
  const session = driver.session();
  try {
    const clubId = parseInt(req.params.id);
    if (isNaN(clubId)) {
      return res.status(400).json({ error: 'Invalid club ID' });
    }
    await session.run('MATCH (c:Club {club_id: $clubId}) DETACH DELETE c', { clubId });
    res.json({ success: true, message: 'Club and related links deleted' });
  } catch (error) {
    console.error('Error deleting club:', error);
    res.status(500).json({ error: 'Failed to delete club' });
  } finally {
    await session.close();
  }
});

// 18. Delete Student
app.delete('/api/students/:id', async (req, res) => {
  const session = driver.session();
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }
    await session.run('MATCH (s:Student {student_id: $studentId}) DETACH DELETE s', { studentId });
    res.json({ success: true, message: 'Student and related links deleted' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  } finally {
    await session.close();
  }
});

// 19. Delete Event
app.delete('/api/events/:id', async (req, res) => {
  const session = driver.session();
  try {
    const eventId = parseInt(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    await session.run('MATCH (e:Event {event_id: $eventId}) DETACH DELETE e', { eventId });
    res.json({ success: true, message: 'Event and related links deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  } finally {
    await session.close();
  }
});

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Campus Club Management Backend is running' });
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
