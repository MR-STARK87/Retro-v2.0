# Views Documentation

This directory contains EJS templates for rendering server-side pages.

## Setup

The view engine is configured in `src/index.js`:

```javascript
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
```

## Available Views

### loginSignUp.ejs

The login and signup page with client-side validation and toast notifications.

**Routes:**
- `/login` - Displays the login form (default view)
- `/signup` - Displays the signup form (default view)

**Features:**
- Toggle between login and signup forms
- Real-time client-side validation matching server-side Zod schemas
- Password strength indicator (signup only)
- Toast notifications for success/error messages
- Responsive design with Tailwind CSS

**Validation Rules:**

**Email:**
- Valid email format

**Password:**
- Minimum 8 characters, maximum 100
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Username:**
- 3-30 characters
- Only letters, numbers, and underscores

**First/Last Name:**
- Required, maximum 50 characters
- Only letters, spaces, hyphens, and apostrophes

**API Endpoints Used:**
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

**Success Behavior:**
- Login: Redirects to `/home` after 1.5 seconds
- Signup: Shows success message, clears form

## Adding New Views

1. Create a new `.ejs` file in this directory
2. Add a route in `src/routes/viewRoutes.js`
3. Use `res.render('viewName', { data })` to render the view

Example:
```javascript
router.get("/dashboard", (req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
    user: req.user
  });
});
```

## Variables Available in All Views

Variables can be passed from routes to views:

```javascript
res.render("viewName", {
  title: "Page Title",
  customVariable: "value"
});
```

Access in EJS:
```html
<title><%= title %></title>
<p><%= customVariable %></p>
```

## Notes

- All API calls use relative paths (e.g., `/api/v1/auth/login`) so they work regardless of port
- Static files are served from the `public` directory
- EJS files can include partials for reusable components