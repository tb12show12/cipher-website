let cropper = null;

export function initializeCoverImage() {
    document.getElementById('coverImage').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Reset previous cropper if exists
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        const imageToEdit = document.getElementById('imageToEdit');
        const instructionsElement = document.querySelector('.cropper-instructions');
        const reader = new FileReader();

        // Set up image load handler
        imageToEdit.onload = function() {
            console.log('Image loaded');
            if (cropper) {
                cropper.destroy();
            }
            
            cropper = new Cropper(imageToEdit, {
                aspectRatio: 16/9,
                viewMode: 2,
                responsive: true,
                background: true,
                zoomable: true,
                dragMode: 'move',
                guides: true,
                center: true,
                highlight: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                autoCrop: true,
                autoCropArea: 0.8,
                movable: true,
                ready: function() {
                    console.log('Cropper initialized');
                    if (instructionsElement) {
                        instructionsElement.style.display = 'block';
                    }
                }
            });
        };

        // Read and load the file
        reader.onload = function(e) {
            imageToEdit.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

export function getCropper() {
    return cropper;
} 