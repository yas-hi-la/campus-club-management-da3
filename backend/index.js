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

// Helper: convert Neo4j's wrapped integers/dates into plain JS values
function cleanProperties(props) {
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

// Get all clubs
app.get('/api/clubs', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (c:Club) RETURN c');
    const clubs = result.records.map(record => cleanProperties(record.get('c').properties));
    res.json(clubs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Get all students
app.get('/api/students', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (s:Student) RETURN s');
    const students = result.records.map(record => cleanProperties(record.get('s').properties));
    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Get all events, with their venue and hosting club
app.get('/api/events', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run(`
      MATCH (c:Club)-[:HOSTS]->(e:Event)-[:HELD_AT]->(v:Venue)
      RETURN e, c.club_name AS club_name, v.building_name AS venue_name, v.room_number AS room_number
    `);
    const events = result.records.map(record => ({
      ...cleanProperties(record.get('e').properties),
      club_name: record.get('club_name'),
      venue_name: record.get('venue_name'),
      room_number: record.get('room_number')
    }));
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Get all venues
app.get('/api/venues', async (req, res) => {
  const session = driver.session();
  try {
    const result = await session.run('MATCH (v:Venue) RETURN v');
    const venues = result.records.map(record => cleanProperties(record.get('v').properties));
    res.json(venues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Get a single student's club memberships and event registrations
app.get('/api/students/:id', async (req, res) => {
  const session = driver.session();
  try {
    const studentId = parseInt(req.params.id);
    const result = await session.run(
      `MATCH (s:Student {student_id: $studentId})
       OPTIONAL MATCH (s)-[:MEMBER_OF]->(c:Club)
       OPTIONAL MATCH (s)-[:REGISTERED_FOR]->(e:Event)
       RETURN s, collect(DISTINCT c.club_name) AS clubs, collect(DISTINCT e.title) AS events`,
      { studentId }
    );
    if (result.records.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const record = result.records[0];
    res.json({
      ...cleanProperties(record.get('s').properties),
      clubs: record.get('clubs'),
      events: record.get('events')
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// ===== POST ROUTES (create new data) =====

// Add a new club
app.post('/api/clubs', async (req, res) => {
  const session = driver.session();
  try {
    const { club_name, category, founded_date } = req.body;

    const idResult = await session.run('MATCH (c:Club) RETURN max(c.club_id) AS maxId');
    const nextId = (idResult.records[0].get('maxId')?.toNumber() || 0) + 1;

    const result = await session.run(
      `CREATE (c:Club {club_id: $clubId, club_name: $clubName, category: $category, founded_date: date($foundedDate)})
       RETURN c`,
      { clubId: nextId, clubName: club_name, category, foundedDate: founded_date }
    );
    res.json(cleanProperties(result.records[0].get('c').properties));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Add a new student
app.post('/api/students', async (req, res) => {
  const session = driver.session();
  try {
    const { first_name, last_name, email, phone, department, academic_year } = req.body;

    const idResult = await session.run('MATCH (s:Student) RETURN max(s.student_id) AS maxId');
    const nextId = (idResult.records[0].get('maxId')?.toNumber() || 0) + 1;

    const result = await session.run(
      `CREATE (s:Student {student_id: $studentId, first_name: $firstName, last_name: $lastName,
               email: $email, phone: $phone, department: $department, academic_year: $academicYear})
       RETURN s`,
      {
        studentId: nextId,
        firstName: first_name,
        lastName: last_name,
        email,
        phone,
        department,
        academicYear: academic_year
      }
    );
    res.json(cleanProperties(result.records[0].get('s').properties));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// Add a new event (linked to an existing club and venue)
app.post('/api/events', async (req, res) => {
  const session = driver.session();
  try {
    const { title, event_type, event_date, start_time, end_time, event_budget, club_id, venue_id } = req.body;

    const idResult = await session.run('MATCH (e:Event) RETURN max(e.event_id) AS maxId');
    const nextId = (idResult.records[0].get('maxId')?.toNumber() || 0) + 1;

    const result = await session.run(
      `MATCH (c:Club {club_id: $clubId}), (v:Venue {venue_id: $venueId})
       CREATE (e:Event {event_id: $eventId, title: $title, event_type: $eventType,
               event_date: date($eventDate), start_time: datetime($startTime),
               end_time: datetime($endTime), event_budget: $eventBudget})
       CREATE (c)-[:HOSTS]->(e)
       CREATE (e)-[:HELD_AT]->(v)
       RETURN e`,
      {
        eventId: nextId,
        title,
        eventType: event_type,
        eventDate: event_date,
        startTime: start_time,
        endTime: end_time,
        eventBudget: parseFloat(event_budget),
        clubId: parseInt(club_id),
        venueId: parseInt(venue_id)
      }
    );
    if (result.records.length === 0) {
      return res.status(400).json({ error: 'Invalid club_id or venue_id' });
    }
    res.json(cleanProperties(result.records[0].get('e').properties));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    await session.close();
  }
});

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.send('Backend is running');
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});