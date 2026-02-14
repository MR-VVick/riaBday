document.addEventListener('DOMContentLoaded', () => {
    const wishInput = document.getElementById('wish-input');
    const nameInput = document.getElementById('name-input');
    const saveBtn = document.getElementById('save-wish-btn');

    // Load existing wishes
    const loadedWishes = JSON.parse(localStorage.getItem('Ria_wishes') || '[]');

    const wishForm = document.querySelector('form[name="wishes"]');
    if (wishForm) {
        wishForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const text = wishInput.value.trim();
            const name = nameInput.value.trim();

            if (!text || !name) {
                alert("Please fill in both name and message! ✍️");
                return;
            }

            const formData = new FormData(wishForm);
            // Safety: Explicitly set the form name again
            formData.set('form-name', 'wishes');

            try {
                saveBtn.disabled = true;
                saveBtn.textContent = "Sending...";

                // Submit to the current URL
                const response = await fetch("/", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams(formData).toString(),
                });

                if (response.ok) {
                    const newWish = { name, message: text, timestamp: new Date().toISOString() };
                    const currentWishes = JSON.parse(localStorage.getItem('Ria_wishes') || '[]');
                    currentWishes.push(newWish);
                    localStorage.setItem('Ria_wishes', JSON.stringify(currentWishes));

                    wishInput.value = '';
                    nameInput.value = '';
                    alert("Wish sent to Ria! 💌");
                } else {
                    throw new Error("Failed to send wish");
                }
            } catch (error) {
                console.error("Submission error:", error);
                alert("Oops! Something went wrong. Please try again later. 😅");
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = "Send Wish 🌠";
            }
        });
    }
});
