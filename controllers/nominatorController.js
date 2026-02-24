const NominatorDao = require("../dao/nominatorDao");

const createNominator = async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const id = await NominatorDao.createNominator({ name, email });
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
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }
    const updated = await NominatorDao.updateNominator(id, { name, email });
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
