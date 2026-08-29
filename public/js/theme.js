    function toggleTheme() {
        const body = document.body;
        const themeToggleIcon = document.getElementById('themeToggleIcon');
        const isDark = body.getAttribute('data-theme') === 'dark';

        if (isDark) {
            body.removeAttribute('data-theme');
            themeToggleIcon.className = 'fas fa-moon';
            localStorage.setItem('theme', 'light');
        } else {
            body.setAttribute('data-theme', 'dark');
            themeToggleIcon.className = 'fas fa-sun';
            localStorage.setItem('theme', 'dark');
        }
    }

    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        const themeToggleIcon = document.getElementById('themeToggleIcon');

        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if (themeToggleIcon) {
                themeToggleIcon.className = 'fas fa-sun';
            }
        }
    }

    // Load theme on page load
    document.addEventListener('DOMContentLoaded', loadSavedTheme);