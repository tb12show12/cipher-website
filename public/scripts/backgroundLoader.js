async function initializeBackground() {
    console.log('Initializing background...');
    
    // List of actual thumbnail filenames
    const thumbnails = [
        "04CZczLLdHmtLqV4Q47S.png",
        "1P5ZWvXXpSHnbDNdLqCv.png",
        "4q0mqdsGZqwb2YpTAYjr.png",
        "63hb7hgbmyQ6RbHZth5W.png",
        "6Ly8HkiHqXMpZGywg0yF.png",
        "9l1Ir5hLoOuRbcUuOO0G.png",
        "ABLdy5kZ9yENtaxv42I6.png",
        "aDB3gOZLBY8JcvLk2dev.png",
        "ANofSzt9meqo7j0rH4FN.png",
        "ChrVuMZl0vAgla276THB.png",
        "CmNIjxC33xdiYtMf2bVw.png",
        "Ct7UmaINSKHY1fM2PHln.png",
        "DUgOOjqSIcYBdRio4JRR.png",
        "dWGLy8ext47lTMop8kDY.png",
        "EQRbpCQwu5IFZlpMKaIx.png",
        "Gq3Xq91WxtE8PLrXctN2.png",
        "jZkoH37dN9oUD1wRR0q2.png",
        "Kf4pM5xQ30Yxx2NAmAdg.png",
        "krM9Srru1cTj9jzxeGIE.png",
        "l8FjbIHnYyyW5eva7OOg.png",
        "NxkOjGCljR8e1LM1llMT.png",
        "RnNBLs7b3weSrrp2i8b3.png",
        "U2LHmPrrQJDvpLGRZ7wB.png",
        "UferjlOh9WWEe01IK0A4.png",
        "uXZpGuWfdF9i49MU1u6Z.png",
        "WBvfkABzv4vucDG963lK.png",
        "x2fbqcQgokdTRshEcTLv.png",
        "xmfnIhJrfOy6SeH4ngoA.png",
        "xQ86XiWWJ8isOiLBGAVF.png",
        "XSy68oJNWvyNvyerGUo0.png",
        "yKBAHWFOcuNQriNJqDO0.png",
        "YQ0i1qQzXmKsVFyaN4Va.png"  
    ];
    
    const grid = document.createElement('div');
    grid.className = 'background-grid';
    
    // Fixed grid: 6 columns x 5 rows = 30 images
    const totalImagesNeeded = 30;
    
    // Shuffle thumbnails once
    const shuffledThumbnails = thumbnails.sort(() => 0.5 - Math.random());
    
    // Create the 30 images
    for (let i = 0; i < totalImagesNeeded; i++) {
        const img = document.createElement('img');
        const filename = shuffledThumbnails[i % shuffledThumbnails.length];
        img.src = `/assets/thumbnails/cropped/${filename}`;
        img.className = 'background-thumbnail';
        grid.appendChild(img);
    }
    
    // Add grid to page
    document.body.insertBefore(grid, document.body.firstChild);
     
    
}

// Only initialize once when page loads
window.addEventListener('load', () => {
    console.log('Page loaded, calling initializeBackground');
    initializeBackground();
});