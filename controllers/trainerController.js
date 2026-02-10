const bcrypt = require("bcryptjs");
const UserDao = require("../dao/userDao");
const TrainerDao = require("../dao/trainerDao");
const db = require("../config/db");
const { Parser } = require("json2csv");
const fs = require("fs");
const path = require("path");

const createTrainer = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      mobile,
      rank,
      specialization,
      prefix,
      officer,
      other_officer,
      designation,
      nationality,
    } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await UserDao.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Get Trainer Role ID
    const [roles] = await db.query(
      "SELECT id FROM roles WHERE name = 'trainer'",
    );
    if (roles.length === 0) {
      return res.status(500).json({ message: "Trainer role not configured" });
    }
    const roleId = roles[0].id;

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle Files
    let digital_signature = null;
    let profile_photo = null;

    if (req.files) {
      if (req.files.digital_signature) {
        digital_signature = req.files.digital_signature[0].filename;
      }
      if (req.files.profile_photo) {
        profile_photo = req.files.profile_photo[0].filename;
      }
    }

    // Create Trainer
    const userId = await TrainerDao.createTrainer({
      role_id: roleId,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      mobile,
      prefix,
      officer,
      other_officer,
      designation,
      nationality,
      rank,
      specialization,
      digital_signature,
      profile_photo,
    });

    res.status(201).json({ message: "Trainer created successfully", userId });
  } catch (error) {
    console.error("Create Trainer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAllTrainers = async (req, res) => {
  try {
    const { search, limit, offset } = req.query;
    const trainers = await TrainerDao.getAllTrainers({ search, limit, offset });
    res.status(200).json(trainers);
  } catch (error) {
    console.error("Get All Trainers Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getTrainerById = async (req, res) => {
  try {
    const trainer = await TrainerDao.getTrainerById(req.params.id);
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }
    res.status(200).json(trainer);
  } catch (error) {
    console.error("Get Trainer By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateTrainer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Handle Files
    if (req.files) {
      if (req.files.digital_signature) {
        updateData.digital_signature = req.files.digital_signature[0].filename;
      }
      if (req.files.profile_photo) {
        updateData.profile_photo = req.files.profile_photo[0].filename;
      }
    }

    // Hash password if updating
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const updated = await TrainerDao.updateTrainer(id, updateData);
    if (!updated) {
      return res
        .status(404)
        .json({ message: "Trainer not found or no changes made" });
    }

    res.status(200).json({ message: "Trainer updated successfully" });
  } catch (error) {
    console.error("Update Trainer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteTrainer = async (req, res) => {
  try {
    const deleted = await TrainerDao.deleteTrainer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Trainer not found" });
    }
    res.status(200).json({ message: "Trainer deleted successfully" });
  } catch (error) {
    console.error("Delete Trainer Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const exportTrainers = async (req, res) => {
  try {
    const trainers = await TrainerDao.getAllTrainers();

    const fields = [
      "id",
      "first_name",
      "last_name",
      "email",
      "mobile",
      "prefix",
      "officer",
      "designation",
      "nationality",
      "rank",
      "specialization",
    ];
    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(trainers);

      res.header("Content-Type", "text/csv");
      res.attachment("trainers.csv");
      return res.send(csv);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Error generating CSV" });
    }
  } catch (error) {
    console.error("Export Trainers Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createTrainer,
  getAllTrainers,
  getTrainerById,
  updateTrainer,
  deleteTrainer,
  exportTrainers,
};
