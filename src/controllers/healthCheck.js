export const healthCheck = (req, res) => {
  try {
    res.status(200).json({ status: "OK", message: "Server is healthy" });
  } catch (error) {
    res.status(500).json({ status: "ERROR", message: "Server error" });
  }
};
