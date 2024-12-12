function createGlobe() {
    const scene = new THREE.Scene();
    
 // Modified size calculation for rectangular shape
 const width = window.innerWidth * 0.9;  // 90% of window width
 const height = window.innerHeight * 0.7; // 70% of window height
    
    
 const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
 const renderer = new THREE.WebGLRenderer({ antialias: true });
 
 renderer.setSize(width, height);  // Set actual width and height
 renderer.setClearColor(0xffffff);

    // Create the globe
    const GLOBE_RADIUS = 5;
    const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('Map_lighten.png'),
    });
    const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(globe);

    // Initial camera position
    camera.position.z = 12;

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // State variables for rotation
    let isMouseDown = false;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    let targetRotation = { x: globe.rotation.x, y: globe.rotation.y };
    
    // Enhanced zoom state with faster transition
    let currentZoom = camera.position.z;
    let targetZoom = currentZoom;
    const ZOOM_SPEED = 1; // Increased for faster zoom
    const MIN_ZOOM = 9;
    const MAX_ZOOM = 12;
    const ZOOM_SMOOTHING = 0.15; // Increased for faster zoom
    
    // Damping and inertia settings
    const DAMPING = 0.95;
    const INERTIA = 0.92;
    const ROTATION_SPEED = 0.002;

    // Store all markers for raycasting
    const markerObjects = [];
    const hoverText = document.createElement('div');
    hoverText.style.cssText = `
        position: fixed;
        display: none;
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        pointer-events: none;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    document.body.appendChild(hoverText);

    // Create hover image overlay
    const hoverImage = document.createElement('div');
    hoverImage.style.cssText = `
        position: fixed;
        display: none;
        width: 200px;
        height: 200px;
        pointer-events: none;
        z-index: 999;
        background-size: cover;
        background-position: center;
        transition: opacity 0.2s ease;
    `;
    document.body.appendChild(hoverImage);


    function addLocationMarkers() {
        function latLngToVector3(lat, lng, radius) {
            const latRad = (lat * Math.PI) / 180;
            const lngRad = (-lng * Math.PI) / 180;
            
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            
            return new THREE.Vector3(x, y, z);
        }

        // Group projects by location
        const projectsByLocation = {};
        projects.forEach(project => {
            if (!projectsByLocation[project.location]) {
                projectsByLocation[project.location] = [];
            }
            projectsByLocation[project.location].push(project);
        });

        const locationCoords = {
            'DUBAI, UAE': { lat: 25.2048, lng: 55.2708 },
            'ABU DHABI': { lat: 24.4539, lng: 54.3773 },
            'MOROCCO': { lat: 31.7917, lng: -7.0926 },
            'QATAR': { lat: 25.3548, lng: 51.1839 },
            'KSA, SAUDI ARABIA': { lat: 23.8859, lng: 45.0792 }
        };

         Object.entries(projectsByLocation).forEach(([location, locationProjects]) => {
            const coords = locationCoords[location];
            if (!coords) return;

            const basePosition = latLngToVector3(coords.lat, coords.lng, GLOBE_RADIUS);

            locationProjects.forEach((project, index) => {
                const markerSize = 0.5;
                const geometry = new THREE.PlaneGeometry(markerSize, markerSize);
                const texture = new THREE.TextureLoader().load(project.image);
                const hoverTexture = project.coverImage ? new THREE.TextureLoader().load(project.coverImage) : texture;
                
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const marker = new THREE.Mesh(geometry, material);
                
                // Store both textures in userData
                marker.userData.defaultTexture = texture;
                marker.userData.hoverTexture = hoverTexture;
                
                const verticalOffset = index * (markerSize * 0.2);
                const offsetPosition = basePosition.clone();
                const up = offsetPosition.clone().normalize();
                offsetPosition.addScaledVector(up, verticalOffset);

                marker.position.copy(offsetPosition);
                marker.lookAt(offsetPosition.clone().multiplyScalar(2));
                
                const normalizedPosition = offsetPosition.clone().normalize();
                marker.position.addScaledVector(normalizedPosition, 0.01);

                marker.userData.project = project;
                markerObjects.push(marker);
                globe.add(marker);
            });
        });
    }

    // Add hover effects
    let hoveredMarker = null;

    function updateHoverEffects(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(markerObjects);

        renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';

        if (intersects.length > 0) {
            const marker = intersects[0].object;
            const project = marker.userData.project;

            // Show hover text
            hoverText.style.display = 'block';
            hoverText.textContent = project.title;
            hoverText.style.left = event.clientX + 15 + 'px';
            hoverText.style.top = event.clientY + 'px';

            if (project.coverImage || project.imageUrl) {
                hoverImage.style.display = 'block';
                hoverImage.style.backgroundImage = `url(${project.coverImage || project.imageUrl})`;
            
                // Adjust positioning to overlay directly on the marker
                const markerPosition = intersects[0].point; // Get the 3D position of the marker
                const vector = markerPosition.project(camera); // Project it to 2D screen space
            
                // Convert normalized coordinates to screen pixels
                const widthHalf = rect.width / 2;
                const heightHalf = rect.height / 2;
                hoverImage.style.left = `${(vector.x * widthHalf) + widthHalf}px`;
                hoverImage.style.top = `${-(vector.y * heightHalf) + heightHalf}px`;
            
                hoverImage.style.opacity = '1'; // Ensure it's fully visible
            }
            
            // Scale up the marker slightly
            if (hoveredMarker !== marker) {
                if (hoveredMarker) {
                    hoveredMarker.scale.setScalar(1);
                }
                marker.scale.setScalar(1.2);
                hoveredMarker = marker;
            }
        } else {
            hoverText.style.display = 'none';
            hoverImage.style.display = 'none';

            if (hoveredMarker) {
                hoveredMarker.scale.setScalar(1);
                hoveredMarker = null;
            }
        }
    }

    renderer.domElement.addEventListener('mousemove', updateHoverEffects);

    addLocationMarkers();

    function handleClick(event) {
        if (isDragging) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(markerObjects);

        if (intersects.length > 0) {
            const project = intersects[0].object.userData.project;
            if (project) {
                openProjectModal(project);
            }
        }
    }
    renderer.domElement.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        isDragging = false;
        previousMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
        renderer.domElement.style.cursor = 'grabbing';
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (!isMouseDown) return;

        const deltaMove = {
            x: event.offsetX - previousMousePosition.x,
            y: event.offsetY - previousMousePosition.y
        };

        if (Math.abs(deltaMove.x) > 3 || Math.abs(deltaMove.y) > 3) {
            isDragging = true;
        }

        if (isDragging) {
            rotationVelocity = {
                x: deltaMove.y * ROTATION_SPEED,
                y: deltaMove.x * ROTATION_SPEED
            };

            targetRotation = {
                x: globe.rotation.x + rotationVelocity.x,
                y: globe.rotation.y + rotationVelocity.y
            };
        }

        previousMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
    });

    renderer.domElement.addEventListener('mouseup', (event) => {
        renderer.domElement.style.cursor = 'grab';
        if (!isDragging) {
            handleClick(event);
        }
        isMouseDown = false;
        isDragging = false;
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        isMouseDown = false;
        isDragging = false;
        hoverText.style.display = 'none';
        hoverImage.style.display = 'none';
        if (hoveredMarker) {
            hoveredMarker.scale.setScalar(1);
            hoveredMarker = null;
        }
    });
    renderer.domElement.addEventListener('wheel', (event) => {
        event.preventDefault();
        
        const zoomDelta = event.deltaY * 0.001;
        targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom + zoomDelta * ZOOM_SPEED));
    }, { passive: false });

    function animate() {
        requestAnimationFrame(animate);

        if (!isMouseDown) {
            rotationVelocity.x *= DAMPING;
            rotationVelocity.y *= DAMPING;

            targetRotation.x += rotationVelocity.x;
            targetRotation.y += rotationVelocity.y;
        }

        globe.rotation.x += (targetRotation.x - globe.rotation.x) * INERTIA;
        globe.rotation.y += (targetRotation.y - globe.rotation.y) * INERTIA;

        // Faster zoom transition
        currentZoom += (targetZoom - currentZoom) * ZOOM_SMOOTHING;
        camera.position.z = currentZoom;

        renderer.render(scene, camera);
    }

    function resizeHandler() {
        const width = window.innerWidth * 0.9;
        const height = window.innerHeight * 0.7;
        renderer.setSize(width, height);
        camera.aspect = width / height;  // Set proper aspect ratio
        camera.updateProjectionMatrix();
    }

    function cleanup() {
        document.body.removeChild(hoverText);
        document.body.removeChild(hoverImage);
    }

    return { renderer, animate, resizeHandler, cleanup };
}
const projects = [
    { 
        id: 1, 
        title: 'SLS WOW HOTEL APARTMENT', 
        abbr: 'SLS', 
        image: "/ICON/SLS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b6964d2f-924b-44d0-903d-f6a28fdab2fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=25b91620-9d48-4ffe-a6fb-e5ce74d0d56f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2015, 
        client: 'WOW INVEST. LIMITED',
        program: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/df0dc95d-f747-4f2b-ae30-7ba50421d813',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dc703231-65cf-4e88-a864-e390ea13297e',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2B.%20Branded%20Hotel%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU0xTIFdPVyBIb3RlbCBBcGFydG1lbnQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/navigate/file/12d2d573-3fcb-4322-ad93-23950fccdedf',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ff6a656d-b0de-48cc-b510-2d6124a61fe1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', // You can use one of your existing images or add a new one
        description: {
            paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
            paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
            paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=cf9ac38d-346b-4c55-97a2-e6bf94ffb890&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=0b09bed9-dcb4-473b-ae25-60495cd28674&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bf67a79e-4fda-43db-9186-f77216b9e4af&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ffd8d234-dba6-48a5-bed1-6bbe08f46897&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]

    },
    { 
        id: 2, 
        title: 'RADISSON BLU HOTEL APARTMENT', 
        abbr: 'RAD', 
        image: "/ICON/RAD.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a92700b-869b-421d-b104-9f30d88488f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e3e8dddb-eb6e-409d-938d-a8eb1e3eafd6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'AL REEM REAL ESTATE DEVELOPMENT EST',
        program: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e4d1ebef-5ef6-488b-8032-9d860ba10da5',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e2c9f501-ef4c-46d0-810c-ce9b80d4f317',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFkaXNzb24gQmx1IEhvdGVsIEFwYXJ0bWVudCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=984f3406-3ecd-478b-9fde-d44a05f862c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', // You can use one of your existing images or add a new one
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=1aaa817a-24b3-44db-b0e7-63cba5afdc93&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5fca849d-65c2-4a93-a182-1909509488b4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dd927d95-b41a-4dd4-a7d6-23b104b84edd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=fa60d4cb-a4d9-4575-a2a1-c3128259f2af&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]

    },
    { 
        id: 3, 
        title: 'CCC', 
        abbr: 'LMS', 
        year: 2017, 
        image: "/ICON/LMS.png",
        epoch: 'FUTURE', 
        program: 'OTHERS', 
        scale: 'L', 
        location: 'ABU DHABI',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0d1a0857-53c2-4b38-81eb-80431f594574&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 4, 
        title: 'DDD', 
        abbr: 'CGA', 
        year: 2018, 
        image: "/ICON/CGA.png",
        epoch: 'PAST', 
        program: 'TRANSPORTATION', 
        scale: 'S', 
        location: 'MOROCCO',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=1b2b58cc-e601-4417-a184-9ca8769a590e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 5, 
        title: 'EEE', 
        abbr: 'SVB', 
        year: 2019, 
        image: "/ICON/SVB.png",
        epoch: 'PRESENT', 
        program: 'RESIDENTIAL', 
        scale: 'M', 
        location: 'QATAR',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e40fd062-1c02-4602-af89-588a1386b413&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 6, 
        title: 'FFF', 
        abbr: 'RUH', 
        year: 2020, 
        image: "/ICON/RUH.png",
        epoch: 'FUTURE', 
        program: 'OFFICE', 
        scale: 'S', 
        location: 'KSA, SAUDI ARABIA',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e727b7fb-8b8f-40de-b2a3-b57adffcd25b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 7, 
        title: 'GGG', 
        abbr: 'SKI', 
        year: 2021, 
        image: "/ICON/SKI.png",
        epoch: 'PAST', 
        program: 'MASTERPLAN', 
        scale: 'L', 
        location: 'KSA, SAUDI ARABIA',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=bc030824-0fbc-4242-80f1-b91854ec6d1e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 8, 
        title: 'HHH', 
        abbr: 'MNZ', 
        year: 2022, 
        image: "/ICON/MNZ.png",

        epoch: 'FUTURE', 
        program: 'HOSPITALITY', 
        scale: 'S', 
        location: 'DUBAI, UAE',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=b9a04c15-f1bc-401b-a0a7-81f7f052061a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 9, 
        title: 'III', 
        abbr: 'ELP', 
        year: 2023, 
        image: "/ICON/ELP.png",
        epoch: 'PAST', 
        program: 'HOSPITALITY', 
        scale: 'M', 
        location: 'DUBAI, UAE',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=87623eed-e4aa-4f0b-bb9c-1e93d4336f64&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    { 
        id: 10, 
        title: 'LLL', 
        abbr: 'MOR', 
        year: 2024, 
        image: "/ICON/MOR.png",
        epoch: 'FUTURE', 
        program: 'RESIDENTIAL', 
        scale: 'L', 
        location: 'DUBAI, UAE',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac894b5a-4921-476e-bc40-7dc26352b6b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    }
];

const filterConfigs = {
    CHRONOLOGICAL: {
        headers: Array.from({ length: 10 }, (_, i) => (2015 + i).toString()),
        getHeader: project => project.year.toString()
    },
    EPOCH: {
        headers: ['PAST', 'PRESENT', 'FUTURE'],
        getHeader: project => project.epoch
    },
    ALPHABETICAL: {
        headers: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        getHeader: project => project.title[0]
    },
    PROGRAMMATIC: {
        headers: ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'],
        getHeader: project => project.program
    },
    SCALE: {
        headers: ['S', 'M', 'L', 'XL'],
        getHeader: project => project.scale
    },
    LOCATION: {
        headers: [...new Set(projects.map(p => p.location))],
        getHeader: project => project.location
    }
};

function getColumnWidth(totalHeaders) {
    const minWidth = 60;
    const maxWidth = 100;
    const padding = 64;
    const availableWidth = window.innerWidth - padding;
    const calculatedWidth = Math.floor(availableWidth / totalHeaders);
    
    return Math.min(Math.max(calculatedWidth, minWidth), maxWidth);
}


function getProjectKey(project, filter) {
    return `project-${project.id}-${filterConfigs[filter].getHeader(project)}`;
}

function createProjectIcon(project, filter) {
    const projectIcon = document.createElement('div');
    projectIcon.className = 'project-icon';
    projectIcon.title = project.title;
    projectIcon.dataset.layoutId = `project-${project.id}`;
    
    // Create and set up the main image
    const img = document.createElement('img');
    img.src = project.imageUrl;
    img.alt = project.title;
    img.className = 'project-icon-image';
    img.loading = 'lazy';
    
    // Create the hover cover image
    const hoverImg = document.createElement('img');
    hoverImg.src = project.coverImage || project.imageUrl;
    hoverImg.alt = project.title;
    hoverImg.className = 'project-icon-hover';
    hoverImg.loading = 'lazy';
    
    // Error handling
    img.onerror = () => {
        img.src = '/placeholder.png';
        console.warn(`Failed to load image for project: ${project.title}`);
    };
    
    hoverImg.onerror = () => {
        hoverImg.src = project.imageUrl;
    };
    
    projectIcon.appendChild(img);
    projectIcon.appendChild(hoverImg);
    return projectIcon;
}
function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    
    // Force display and scroll reset
    modal.style.display = 'block';
    modal.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    
    modal.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Set the cover image
    document.getElementById('projectCoverImage').src = project.coverImage;
    document.getElementById('projectIconImage').src = project.imageUrl;

    // Set project details
    document.getElementById('projectTitle').textContent = project.title;
    document.getElementById('projectLocation').textContent = project.location || 'N/A';
    document.getElementById('projectDate').textContent = project.year || 'N/A';
    document.getElementById('projectClientValue').textContent = project.client || 'N/A';
    document.getElementById('projectTypologyValue').textContent = project.program || 'N/A';

    // Set description section
    document.getElementById('projectDescriptionImage').src = project.descriptionImage || '';
    document.getElementById('descriptionParagraph1').textContent = project.description?.paragraph1 || 
        "The project's first conceptual framework emphasizes innovative design solutions that respond to both environmental and social contexts.";
    document.getElementById('descriptionParagraph2').textContent = project.description?.paragraph2 || 
        "Our approach integrates sustainable practices with modern functionality, resulting in spaces that are both environmentally conscious and aesthetically striking.";
    document.getElementById('descriptionParagraph3').textContent = project.description?.paragraph3 || 
        "The final outcome represents a harmonious blend of form and function, where each design element serves a purpose while contributing to the overall architectural narrative.";

    // Set team members section
    document.getElementById('teamLabel').textContent = "TEAM:";
    document.getElementById('teamMembers').textContent = project.teamMembers || 
        "Team members information not available";

    // Update project links
    const linksContainer = document.querySelector('.project-links');
    linksContainer.innerHTML = ''; // Clear existing links

    const projectLinks = [
        { href: project.threeDLink, src: project.linkImages?.threeD, alt: '3D View' },
        { href: project.animationLink, src: project.linkImages?.animation, alt: 'Animation' },
        { href: project.drawingLink, src: project.linkImages?.drawing, alt: 'Drawings' },
        { href: project.visualLink, src: project.linkImages?.visual, alt: 'Visuals' },
        { href: project.presentationLink, src: project.linkImages?.presentation, alt: 'Presentation' }
    ];

    projectLinks.filter(link => link.href && link.src).forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';

        const image = document.createElement('img');
        image.src = link.src;
        image.alt = link.alt;

        anchor.appendChild(image);
        linksContainer.appendChild(anchor);
    });

    // Add Gallery Images
    const galleryContainer = document.querySelector('.gallery-container');
    galleryContainer.innerHTML = ''; // Clear existing images

    // Check if project.galleryImages exists and is an array
    if (project.galleryImages && Array.isArray(project.galleryImages)) {
        project.galleryImages.forEach(imageUrl => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'gallery-image-container';

            const image = document.createElement('img');
            image.src = imageUrl;
            image.className = 'gallery-image';
            image.alt = 'Project Gallery Image';

            // Add loading state
            image.onload = () => {
                imageContainer.classList.add('loaded');
            };
            image.onerror = () => {
                imageContainer.classList.add('error');
            };

            imageContainer.appendChild(image);
            galleryContainer.appendChild(imageContainer);
        });
    }

    // Remove any existing event listeners
    const closeButton = modal.querySelector('.close-modal');
    const homeButton = modal.querySelector('.home-modal');
    const oldKeydownHandler = modal.keydownHandler;
    if (oldKeydownHandler) {
        document.removeEventListener('keydown', oldKeydownHandler);
    }

    const closeModalAndReset = () => {
        modal.style.display = 'none';
        modal.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant'
        });
        window.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant'
        });
        modal.scrollTop = 0;
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.body.style.overflow = 'auto';
        document.documentElement.style.scrollBehavior = 'auto';
    };

    closeButton.onclick = closeModalAndReset;
    homeButton.onclick = closeModalAndReset;

    // Add keyboard navigation for closing modal
    const keydownHandler = function(event) {
        if (event.key === 'Escape') {
            closeModalAndReset();
            document.removeEventListener('keydown', keydownHandler);
        }
    };
    modal.keydownHandler = keydownHandler;
    document.addEventListener('keydown', keydownHandler);

    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Add smooth scrolling after initial position is set
    setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'smooth';
    }, 100);

    // Force one final scroll to top after a slight delay
    setTimeout(() => {
        modal.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant'
        });
    }, 50);
}


function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    modal.style.display = 'none';
}

document.querySelector('.close-modal').addEventListener('click', closeProjectModal);

document.getElementById('projectGrid').addEventListener('click', event => {
    if (event.target.closest('.project-icon')) {
        const projectId = event.target.closest('.project-icon').dataset.layoutId.split('-')[1];
        const project = projects.find(p => p.id === parseInt(projectId, 10));
        openProjectModal(project);
    }
});

function updateGrid(activeFilter) {
    const grid = document.getElementById('projectGrid');
    const oldIcons = Array.from(grid.querySelectorAll('.project-icon'));
    const oldPositions = new Map();

    // Store old positions
    oldIcons.forEach(icon => {
        const rect = icon.getBoundingClientRect();
        oldPositions.set(icon.dataset.layoutId, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        });
    });
    if (activeFilter === 'LOCATION') {
        grid.innerHTML = '';
        grid.style.width = '90vw';
        grid.style.height = '70vh';
        grid.style.position = 'relative';
        grid.style.overflow = 'hidden';
        grid.style.margin = '0 auto';
        grid.style.marginTop = '20px';
    
        try {
            const { renderer, animate, resizeHandler, cleanup } = createGlobe();
            if (renderer && renderer.domElement) {
                grid.appendChild(renderer.domElement);
                animate();
                window.addEventListener('resize', resizeHandler);
                // Add cleanup on filter change
                return () => {
                    cleanup();
                    window.removeEventListener('resize', resizeHandler);
                };
            }
        } catch (error) {
            console.error('Error setting up globe:', error);
        }
        return;
    }
    // Reset styles for other views
    grid.style.width = '';
    grid.style.height = '';
    grid.style.position = '';
    grid.style.overflow = '';
    grid.style.margin = '';
    grid.style.marginTop = '';

    // Clear current grid content
    grid.innerHTML = '';

    // Generate new layout
    const newIcons = [];
    filterConfigs[activeFilter].headers.forEach(header => {
        const column = document.createElement('div');
        column.className = 'column';
        column.style.width = `${getColumnWidth(filterConfigs[activeFilter].headers.length)}px`;

        const projectStack = document.createElement('div');
        projectStack.className = 'project-stack';

        const filteredProjects = projects.filter(
            project => filterConfigs[activeFilter].getHeader(project) === header
        );

        filteredProjects.forEach(project => {
            const projectIcon = createProjectIcon(project, activeFilter);
            projectStack.appendChild(projectIcon);
            newIcons.push(projectIcon);
        });

        const headerDiv = document.createElement('div');
        headerDiv.className = 'header';
        headerDiv.textContent = header;

        column.appendChild(projectStack);
        column.appendChild(headerDiv); // Add header to column
        grid.appendChild(column); // Add column to grid
    });

    // Store new positions and animate
    newIcons.forEach(icon => {
        const layoutId = icon.dataset.layoutId;
        const rect = icon.getBoundingClientRect();
        const oldPos = oldPositions.get(layoutId);

        if (oldPos) {
            // Set initial transform for animation
            const deltaX = oldPos.left - rect.left;
            const deltaY = oldPos.top - rect.top;
            const scaleX = oldPos.width / rect.width;
            const scaleY = oldPos.height / rect.height;

            icon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
            icon.style.opacity = '0';

            // Force reflow
            icon.offsetHeight;

            // Transition to new position
            requestAnimationFrame(() => {
                icon.style.transform = 'translate(0, 0) scale(1, 1)';
                icon.style.opacity = '1';
                icon.classList.add('transitioning');
            });
        } else {
            // New icons fade in
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.8)';
            icon.classList.add('transitioning');
            requestAnimationFrame(() => {
                icon.style.opacity = '1';
                icon.style.transform = 'scale(1)';
            });
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectGrid = document.getElementById('projectGrid');    
    let activeHoverArea = null;
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const resetTabs = () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Set the first tab as active (assuming you want the first tab as default)
        if (tabButtons.length > 0 && tabContents.length > 0) {
            tabButtons[0].classList.add('active');
            const firstTabId = tabButtons[0].dataset.tab;
            document.getElementById(firstTabId).classList.add('active');
        }
    };
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active');
        });
    });

    const infoTab = document.querySelector('.info-tab');
    const infoModal = document.getElementById('infoModal');
    const infoHomeButton = infoModal.querySelector('.home-modal');
    const infoCloseButton = infoModal.querySelector('.info-close');

        // Info Modal Open
        infoTab.addEventListener('click', () => {
            resetTabs(); // Reset tabs when opening the modal
            infoModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        });
        infoHomeButton.onclick = () => {
            infoModal.style.display = 'none';
            window.scrollTo(0, 0);
            document.body.style.overflow = 'auto';
            resetTabs();
        };
        infoCloseButton.addEventListener('click', () => {
            infoModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetTabs();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && infoModal.style.display === 'flex') {
                infoModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                resetTabs();
            }
        });

        projectGrid.addEventListener('mousemove', (event) => {
            const hoverText = document.querySelector('.hover-text');
            const projectIcon = event.target.closest('.project-icon');
            
            if (hoverText && projectIcon) {
                // Changed to use projectIcon bounds instead of hover image
                const iconRect = projectIcon.getBoundingClientRect();
                
                const isWithinHoverArea = (
                    event.clientX >= iconRect.left &&
                    event.clientX <= iconRect.right &&
                    event.clientY >= iconRect.top &&
                    event.clientY <= iconRect.bottom
                );
                
                if (isWithinHoverArea) {
                    hoverText.style.left = `${event.pageX + 15}px`;
                    hoverText.style.top = `${event.pageY - 10}px`;
                    hoverText.style.opacity = '1';
                } else {
                    hoverText.style.opacity = '0';
                }
            }
        });
    // Existing Project Grid Mouse Over Handler
    projectGrid.addEventListener('mouseover', (event) => {
        const projectIcon = event.target.closest('.project-icon');
        
        if (projectIcon && !activeHoverArea) {
            activeHoverArea = projectIcon;
            const hoverText = document.createElement('div');
            hoverText.classList.add('hover-text');
            hoverText.innerText = projectIcon.getAttribute('title');
            document.body.appendChild(hoverText);

            projectIcon.dataset.originalTitle = projectIcon.getAttribute('title');
            projectIcon.removeAttribute('title');

            projectIcon.classList.add('hover-active');
        }
    });

    // Existing Project Grid Mouse Out Handler
    projectGrid.addEventListener('mouseout', (event) => {
        const projectIcon = event.target.closest('.project-icon');
        const relatedTarget = event.relatedTarget;
        
        if (projectIcon && 
            !projectIcon.contains(relatedTarget) && 
            !relatedTarget?.closest('.project-icon-hover')) {
            
            const hoverText = document.querySelector('.hover-text');
            if (hoverText) {
                hoverText.remove();
            }

            if (activeHoverArea) {
                if (activeHoverArea.dataset.originalTitle) {
                    activeHoverArea.setAttribute('title', activeHoverArea.dataset.originalTitle);
                    delete activeHoverArea.dataset.originalTitle;
                }
                activeHoverArea.classList.remove('hover-active');
                activeHoverArea = null;
            }
        }
    });

    // Existing Filter Buttons Handler
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateGrid(button.dataset.filter);
        });
    });

    updateGrid('CHRONOLOGICAL');
});
window.addEventListener('resize', () => {
    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    updateGrid(activeFilter);
});

