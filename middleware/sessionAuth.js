// Update the sessionAuth middleware to check for suspended status
module.exports = (req, res, next) => {
  // Check if user is logged in
  if (!req.session.user) {
    // Check if this is an API route (expects JSON response)
    if (req.path.includes('/bookings/') || req.path.includes('/providers/') || 
        req.path.includes('/packages/') || req.path.includes('/tourist-locations/') ||
        req.path.includes('/reports/') || req.path.includes('/create-admin')) {
      return res.status(401).json({ error: "Please log in to access this page" })
    }
    
    req.session.error = "Please log in to access this page"
    return res.redirect("/userlogin")
  }

  // Check if user is suspended
  if (req.session.user.is_suspended) {
    // Check if this is an API route (expects JSON response)
    if (req.path.includes('/bookings/') || req.path.includes('/providers/') || 
        req.path.includes('/packages/') || req.path.includes('/tourist-locations/') ||
        req.path.includes('/reports/') || req.path.includes('/create-admin')) {
      return res.status(403).json({ error: "Your account has been suspended. Please contact an administrator." })
    }
    
    req.session.error = "Your account has been suspended. Please contact an administrator."
    req.session.destroy()
    return res.redirect("/userlogin")
  }

  
  next()
}
