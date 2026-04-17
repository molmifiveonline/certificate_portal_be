const bcrypt = require("bcryptjs");
const NominatorDao = require("../dao/nominatorDao");
const UserDao = require("../dao/userDao");

const normalizeNominatorPayload = async (body, isEditMode = false) => {
  const {
    first_name,
    last_name = "",
    email,
    mobile,
    password,
    location,
    status = 1,
    gender,
  } = body;

  if (!first_name || !email || !mobile || !location) {
    return {
      error: "First name, email, mobile, and location are required",
    };
  }

  if (!isEditMode && !password) {
    return { error: "Password is required" };
  }

  const payload = {
    first_name,
    last_name,
    email,
    mobile,
    location,
    status: Number(status) === 0 ? 0 : 1,
    gender,
  };

  if (password) {
    payload.password = await bcrypt.hash(password, 10);
  }

  return { payload };
};

const createNominator = async (req, res) => {
  try {
    const { error, payload } = await normalizeNominatorPayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const [existingNominator, existingUser] = await Promise.all([
      NominatorDao.findNominatorByEmail(payload.email),
      UserDao.findUserByEmail(payload.email),
    ]);

    if (existingNominator || existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists. Please use a different email" });
    }

    const id = await NominatorDao.createNominator(payload);
    res.status(201).json({ message: "Nominator created successfully", id });
  } catch (error) {
    console.error("Create Nominator Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAllNominators = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const nominators = await NominatorDao.getAllNominators(page, limit, search);
    res.status(200).json(nominators);
  } catch (error) {
    console.error("Get All Nominators Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getNominatorById = async (req, res) => {
  try {
    const nominator = await NominatorDao.getNominatorById(req.params.id);
    if (!nominator) {
      return res.status(404).json({ message: "Nominator not found" });
    }
    res.status(200).json(nominator);
  } catch (error) {
    console.error("Get Nominator By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateNominator = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, payload } = await normalizeNominatorPayload(req.body, true);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const existingNominator = await NominatorDao.findNominatorByEmail(payload.email);
    if (existingNominator && existingNominator.id !== id) {
      return res
        .status(400)
        .json({ message: "Email already exists. Please use a different email" });
    }

    const existingUser = await UserDao.findUserByEmail(payload.email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email already exists. Please use a different email" });
    }

    const updated = await NominatorDao.updateNominator(id, payload);
    if (!updated) {
      return res.status(404).json({ message: "Nominator not found" });
    }
    res.status(200).json({ message: "Nominator updated successfully" });
  } catch (error) {
    console.error("Update Nominator Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteNominator = async (req, res) => {
  try {
    const deleted = await NominatorDao.deleteNominator(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Nominator not found" });
    }
    res.status(200).json({ message: "Nominator deleted successfully" });
  } catch (error) {
    console.error("Delete Nominator Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createNominator,
  getAllNominators,
  getNominatorById,
  updateNominator,
  deleteNominator,
};
