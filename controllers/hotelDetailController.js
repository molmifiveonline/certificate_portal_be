const HotelDetailDao = require("../dao/HotelDetailDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getHotels = async (req, res) => {
  try {
    const { search, page, limit, sort_by, sort_order } = req.query;
    const result = await HotelDetailDao.getAllHotels({
      search,
      page,
      limit,
      sort_by,
      sort_order,
    });
    return ok(res, "Hotels fetched successfully", result);
  } catch (err) {
    console.error("Get All Hotels Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getHotel = async (req, res) => {
  try {
    const { id } = req.params;
    const hotel = await HotelDetailDao.getHotelById(id);
    if (!hotel) {
      return error(res, 404, "Hotel not found");
    }

    // Hotel details do not have files in the current requirement
    // const files = await HotelDetailDao.getHotelFiles(id);
    // hotel.files = files;

    return ok(res, "Hotel fetched successfully", hotel);
  } catch (err) {
    console.error("Get Hotel Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const addHotel = async (req, res) => {
  try {
    const { venue_name, venue_address, venue_contact, venue_map_link, email } =
      req.body;

    if (!venue_name || !venue_address) {
      return error(res, 400, "Venue name and address are required");
    }

    const hotelId = await HotelDetailDao.createHotel({
      venue_name,
      venue_address,
      venue_contact,
      venue_map_link,
      email,
    });

    // Handle files if uploaded
    if (req.files && req.files.hotel_files) {
      // Temporarily disabled since hotel_files is used for candidate course enrollment
      // for (const file of req.files.hotel_files) {
      //   await HotelDetailDao.createHotelFile({
      //     hotel_id: hotelId,
      //     file_name: file.filename,
      //     file_type: file.mimetype,
      //   });
      // }
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "CREATE_HOTEL",
        details: `Created hotel: ${venue_name}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Hotel created successfully", { hotelId });
  } catch (err) {
    console.error("Add Hotel Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const updateHotel = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await HotelDetailDao.updateHotel(id, updateData);
    if (!updated) {
      return error(res, 404, "Hotel not found or no changes made");
    }

    // Handle new files if uploaded
    if (req.files && req.files.hotel_files) {
      // Temporarily disabled since hotel_files is used for candidate course enrollment
      // for (const file of req.files.hotel_files) {
      //   await HotelDetailDao.createHotelFile({
      //     hotel_id: id,
      //     file_name: file.filename,
      //     file_type: file.mimetype,
      //   });
      // }
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_HOTEL",
        details: `Updated hotel ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Hotel updated successfully");
  } catch (err) {
    console.error("Update Hotel Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const deleteHotel = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await HotelDetailDao.deleteHotel(id);
    if (!deleted) {
      return error(res, 404, "Hotel not found");
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_HOTEL",
        details: `Deleted hotel ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Hotel deleted successfully");
  } catch (err) {
    console.error("Delete Hotel Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    // Temporarily disabled since hotel_files is used for candidate course enrollment
    // const deleted = await HotelDetailDao.deleteHotelFile(fileId);
    // if (!deleted) {
    //   return error(res, 404, "File not found");
    // }

    return ok(res, "File deleted successfully");
  } catch (err) {
    console.error("Delete Hotel File Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getHotels,
  getHotel,
  addHotel,
  updateHotel,
  deleteHotel,
  deleteFile,
};
