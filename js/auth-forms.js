document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = registerForm.querySelector('button[type="submit"]');

            btn.disabled = true;
            btn.textContent = 'Registrazione...';

            const { data, error } = await window.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName
                    }
                }
            });

            if (error) {
                alert('Errore durante la registrazione: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Registrati';
            } else {
                alert('Registrazione avvenuta con successo! Controlla la tua email per confermare l\'account.');
                window.location.href = 'login.html';
            }
        });
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = loginForm.querySelector('button[type="submit"]');

            btn.disabled = true;
            btn.textContent = 'Accesso...';

            const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                alert('Errore durante l\'accesso: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Accedi';
            } else {
                window.location.href = 'landingpage.html';
            }
        });
    }
});
