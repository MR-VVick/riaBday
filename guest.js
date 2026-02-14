document.addEventListener('DOMContentLoaded', () => {
    const wishInput = document.getElementById('wish-input');
    const nameInput = document.getElementById('name-input');
    const saveBtn = document.getElementById('save-wish-btn');

    // Load existing wishes
    const loadedWishes = JSON.parse(localStorage.getItem('Ria_wishes') || '[]');

    saveBtn.addEventListener('click', () => {
        const text = wishInput.value.trim();
        const name = nameInput.value.trim();

        if (!text) {
            alert("Please write a wish! ✍️");
            return;
        }
        if (!name) {
            alert("Please sign your name! 📛");
            return;
        }

        // Save as object
        const newWish = { name, message: text, timestamp: new Date().toISOString() };
        loadedWishes.push(newWish);
        localStorage.setItem('Ria_wishes', JSON.stringify(loadedWishes));

        wishInput.value = '';
        nameInput.value = '';
        alert("Wish sent to Ria! 💌");
    });
});
