const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const ExcelJS = require("exceljs");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// === Connect or Create Database ===
const db = new sqlite3.Database("attendance.db", (err) => {
  if (err) {
    console.error("DB connection error:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

// === Create Tables If Not Exists ===
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      regNumber TEXT PRIMARY KEY,
      studentName TEXT,
      mobileNumber TEXT,
      collegeName TEXT,
      collegeAddress TEXT,
      duration TEXT,
      Project Title TEXT,
      issueDate TEXT,
      courseDepartment TEXT,
      projectTitle TEXT,
      technologiesUsed TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regNumber TEXT,
      date TEXT,
      present INTEGER,
      timestamp TEXT,
      FOREIGN KEY (regNumber) REFERENCES students(regNumber)
    )
  `);
});

// === Routes ===

// POST: Add a student
app.post("/api/students", (req, res) => {
  const {
    studentName,
    regNumber,
    mobileNumber,
    collegeName,
    collegeAddress,
    duration,
    projectTitle,
    issueDate,
    technologiesUsed
  } = req.body;

  const stmt = db.prepare(`
    INSERT INTO students (
      regNumber, studentName, mobileNumber,
      collegeName, collegeAddress, duration,
      Project Title, issueDate, technologiesUsed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    regNumber,
    studentName,
    mobileNumber,
    collegeName,
    collegeAddress,
    duration,
    projectTitle,
    issueDate,
    technologiesUsed,
    function (err) {
      if (err) {
        console.error("Insert error:", err.message);
        return res.status(400).json({ message: "Student already exists or data invalid." });
      }
      res.json({ message: "Student added successfully." });
    }
  );

  stmt.finalize();
});

// GET: Fetch all students
app.get("/api/students", (req, res) => {
  db.all("SELECT * FROM students", (err, rows) => {
    if (err) {
      console.error("Error fetching students:", err.message);
      return res.status(500).json({ message: "Internal server error." });
    }
    res.json(rows);
  });
});

// POST: Submit attendance
app.post("/api/attendance", (req, res) => {
  const { records } = req.body;

  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ message: "Invalid attendance data." });
  }

  const stmt = db.prepare(`
    INSERT INTO attendance (regNumber, date, present, timestamp)
    VALUES (?, ?, ?, ?)
  `);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    for (const record of records) {
      stmt.run(record.regNumber, record.date, record.present ? 1 : 0, record.timestamp);
    }
    db.run("COMMIT", (err) => {
      if (err) {
        console.error("Transaction failed:", err.message);
        return res.status(500).json({ message: "Failed to record attendance." });
      }
      res.json({ message: "Attendance saved." });
    });
  });

  stmt.finalize();
});

// GET: Fetch single student by regNumber
app.get("/api/students/:regNumber", (req, res) => {
  const regNumber = req.params.regNumber;
  db.get("SELECT * FROM students WHERE regNumber = ?", [regNumber], (err, row) => {
    if (err) {
      console.error("Error fetching student:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }
    if (!row) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json(row);
  });
});

// PUT: Update student by regNumber
app.put("/api/students/:regNumber", (req, res) => {
  const regNumber = req.params.regNumber;
  const {
    studentName,
    mobileNumber,
    collegeName,
    collegeAddress,
    duration,
    designation,
    issueDate,
    courseDepartment,
    projectTitle
  } = req.body;

  db.run(`
    UPDATE students SET
      studentName = ?,
      mobileNumber = ?,
      collegeName = ?,
      collegeAddress = COALESCE(?, collegeAddress),
      duration = COALESCE(?, duration),
      designation = COALESCE(?, designation),
      issueDate = COALESCE(?, issueDate),
      courseDepartment = ?,
      projectTitle = ?
      technologiesUsed = ?
    WHERE regNumber = ?
  `, [
    studentName,
    mobileNumber,
    collegeName,
    collegeAddress,
    duration,
    designation,
    issueDate,
    courseDepartment || null,
    projectTitle || null,
    regNumber
  ], function (err) {
    if (err) {
      console.error("Error updating student:", err.message);
      return res.status(500).json({ message: "Failed to update student." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Student not found." });
    }
    res.json({ message: "Student updated." });
  });
});

// DELETE: Remove student by regNumber
app.delete("/api/students/:regNumber", (req, res) => {
  const regNumber = req.params.regNumber;
  db.run("DELETE FROM students WHERE regNumber = ?", [regNumber], function (err) {
    if (err) {
      console.error("Error deleting student:", err.message);
      return res.status(500).json({ message: "Failed to delete student." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Student not found." });
    }
    res.json({ message: "Student deleted." });
  });
});

// GET: Attendance history for a student
app.get("/api/attendance/:regNumber", (req, res) => {
  const regNumber = req.params.regNumber;
  db.all("SELECT * FROM attendance WHERE regNumber = ? ORDER BY date DESC", [regNumber], (err, rows) => {
    if (err) {
      console.error("Error fetching attendance:", err.message);
      return res.status(500).json({ message: "Internal server error" });
    }
    res.json(rows);
  });
});
// GET: Attendance summary for a student
app.get("/api/attendance-summary/:regNumber", (req, res) => {
    const regNumber = req.params.regNumber;
  
    db.all("SELECT present FROM attendance WHERE regNumber = ?", [regNumber], (err, rows) => {
      if (err) {
        console.error("Error calculating summary:", err.message);
        return res.status(500).json({ message: "Internal server error" });
      }
  
      const summary = {
        regNumber,
        present: 0,
        absent: 0,
        total: rows.length
      };
  
      rows.forEach((row) => {
        if (row.present) summary.present++;
        else summary.absent++;
      });
  
      res.json(summary);
    });
  });

  // GET: Export contractor attendance to Excel
  app.get("/api/export-excel", async (req, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Attendance");
  
      // Define Excel columns
      worksheet.columns = [
        { header: "Name", key: "studentName", width: 20 },
        { header: "Pass Number", key: "regNumber", width: 15 },
        { header: "Mobile", key: "mobileNumber", width: 15 },
        { header: "Company", key: "collegeName", width: 20 },
        { header: "Address", key: "collegeAddress", width: 25 },
        { header: "Duration", key: "duration", width: 12 },
        { header: "Project Title", key: "Project Title", width: 18 },
        { header: "Technologies", key: "technologiesUsed", width: 25 },
        { header: "Attendance Date", key: "date", width: 15 },
        { header: "Status", key: "present", width: 10 },
        { header: "Timestamp", key: "timestamp", width: 22 },
      ];
  
      // Query to join students with attendance
      db.all(`
        SELECT s.studentName, s.regNumber, s.mobileNumber, s.collegeName,
               s.collegeAddress, s.duration, s.designation,
               a.date, a.present, a.timestamp
        FROM students s
        LEFT JOIN attendance a ON s.regNumber = a.regNumber
        ORDER BY s.regNumber, a.date DESC
      `, [], async (err, rows) => {
        if (err) {
          console.error("Excel export error:", err.message);
          return res.status(500).send("Failed to export Excel.");
        }
  
        rows.forEach(row => {
          worksheet.addRow({
            ...row,
            present: row.present === 1 ? "Present" : row.present === 0 ? "Absent" : "—"
          });
        });
  
        const buffer = await workbook.xlsx.writeBuffer();
  
        res.setHeader("Content-Disposition", "attachment; filename=contractor_attendance.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buffer);
      });
  
    } catch (error) {
      console.error("Excel export route error:", error);
      res.status(500).send("Server error during export.");
    }
  });

  

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Backend server running at http://localhost:${PORT}`);
});