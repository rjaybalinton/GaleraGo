
// middleware/roleAuth.js
const roleAuth = (allowedRoles) => {
    return (req, res, next) => {
      if (!req.session.user) {
        req.session.error = 'Please log in to access this page.';
        return res.redirect('/userlogin');
      }
      
      console.log("User type:", req.session.user.user_type);
      console.log("Allowed roles:", allowedRoles);
      
      if (allowedRoles.includes(req.session.user.user_type)) {
        return next();
      } else {
        req.session.error = 'You do not have permission to access this page.';
        
        // Redirect based on user type
        switch(req.session.user.user_type) {
          case 'admin':
            return res.redirect('/admin/dashboard');
          case 'entry_provider':
            return res.redirect('/provider/entry');
          case 'activity_provider':
            return res.redirect('/provider/activities');
          case 'tourist':
          default:
            return res.redirect('/user/home');
        }
      }
    };
  };
  
  module.exports = roleAuth;