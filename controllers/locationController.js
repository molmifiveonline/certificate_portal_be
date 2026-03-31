const LocationDao = require("../dao/LocationDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getLocations = async (req, res) => {
  try {
    const result = await LocationDao.getAllLocations(req.query);
    return ok(res, "Locations fetched successfully", result);
  } catch (err) {
    console.error("Error in getLocations controller:", err);
    return error(res, 500, "Failed to fetch locations");
  }
};

const getLocationById = async (req, res) => {
  try {
    const location = await LocationDao.getLocationById(req.params.id);
    if (!location) {
      return error(res, 404, "Location not found");
    }
    return ok(res, "Location details fetched", location);
  } catch (err) {
    console.error("Error in getLocationById controller:", err);
    return error(res, 500, "Failed to fetch location details");
  }
};

const createLocation = async (req, res) => {
  try {
    const location = await LocationDao.createLocation(req.body);

    // Log activity
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "CREATE_LOCATION",
        details: `Created new location: ${location.location_name}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Location created successfully", location);
  } catch (err) {
    console.error("Error in createLocation controller:", err);
    return error(res, 500, "Failed to create location");
  }
};

const updateLocation = async (req, res) => {
  try {
    const location = await LocationDao.updateLocation(req.params.id, req.body);

    // Log activity
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_LOCATION",
        details: `Updated location: ${location.location_name}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Location updated successfully", location);
  } catch (err) {
    console.error("Error in updateLocation controller:", err);
    return error(res, 500, "Failed to update location");
  }
};

const deleteLocation = async (req, res) => {
  try {
    const location = await LocationDao.getLocationById(req.params.id);
    if (!location) {
      return error(res, 404, "Location not found");
    }

    await LocationDao.deleteLocation(req.params.id);

    // Log activity
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_LOCATION",
        details: `Deleted location: ${location.location_name}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Location deleted successfully");
  } catch (err) {
    console.error("Error in deleteLocation controller:", err);
    return error(res, 500, "Failed to delete location");
  }
};

module.exports = {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
};
