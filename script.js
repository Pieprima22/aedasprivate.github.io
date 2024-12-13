function createGlobe() {
    const scene = new THREE.Scene();
    
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.7;
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(width, height);
    renderer.setClearColor(0xffffff);

    // Create the globe
    const GLOBE_RADIUS = 5;
    const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('Map_lighten.png'),
    });
    const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(globe);

    camera.position.z = 10;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // State variables
    let isMouseDown = false;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    let targetRotation = { x: globe.rotation.x, y: globe.rotation.y };
    
    let currentZoom = camera.position.z;
    let targetZoom = currentZoom;
    const ZOOM_SPEED = 1;
    const MIN_ZOOM = 9;
    const MAX_ZOOM = 12;
    const ZOOM_SMOOTHING = 0.15;
    
    const DAMPING = 0.95;
    const INERTIA = 0.92;
    const ROTATION_SPEED = 0.002;

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
        font-family: 'AkkuratStd', sans-serif;

    `;
    document.body.appendChild(hoverText);

    // Add these new functions for search functionality
    function updateMarkersForSearch(query) {
        const searchQuery = query.toLowerCase();
        
        markerObjects.forEach(marker => {
            const project = marker.userData.project;
            const matches = project.title.toLowerCase().includes(searchQuery) ||
                          project.typology?.toLowerCase().includes(searchQuery) ||
                          project.program?.toLowerCase().includes(searchQuery) ||
                          project.location?.toLowerCase().includes(searchQuery);

            if (matches) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
            marker.material.needsUpdate = true;
        });
    }
    function resetAllMarkers() {
        markerObjects.forEach(marker => {
            marker.visible = true;
            marker.scale.setScalar(1);
            marker.material.opacity = 1;
            marker.material.needsUpdate = true;
        });
    }

    function filterMarkersByKeyword(keyword) {
        markerObjects.forEach(marker => {
            const project = marker.userData.project;
            const matches = project.typology === keyword || 
                          project.program === keyword || 
                          (keyword === "HIGH-RISE" && project.scale === "XL") ||
                          (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                          (keyword === "BUILT" && project.epoch === "PRESENT");

            if (matches) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
            marker.material.needsUpdate = true;
        });
    }


    function addLocationMarkers() {
        function latLngToVector3(lat, lng, radius) {
            const latRad = (lat * Math.PI) / 180;
            const lngRad = (-lng * Math.PI) / 180;
            
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            
            return new THREE.Vector3(x, y, z);
        }

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
                const hoverTexture = project.hoverImage ? new THREE.TextureLoader().load(project.hoverImage) : texture;
                
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const marker = new THREE.Mesh(geometry, material);
                
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
    let hoveredMarker = null;
function updateHoverEffects(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markerObjects);

    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';

    // First, handle the case when we're not hovering over any marker
    if (intersects.length === 0) {
        if (hoveredMarker) {
            // Reset the current hovered marker
            resetMarkerState(hoveredMarker);
            hoveredMarker = null;
        }
        hoverText.style.display = 'none';
        return;
    }

    const currentMarker = intersects[0].object;
    const project = currentMarker.userData.project;

    // If we're hovering over a different marker than before
    if (hoveredMarker !== currentMarker) {
        // Reset the previous marker if it exists
        if (hoveredMarker) {
            resetMarkerState(hoveredMarker);
        }

        // Set up the new hover state
        currentMarker.material.map = currentMarker.userData.hoverTexture;
        currentMarker.material.needsUpdate = true;
        currentMarker.scale.setScalar(1.2);
        hoveredMarker = currentMarker;

        // Update hover text
        hoverText.style.display = 'block';
        hoverText.textContent = project.title;
        hoverText.style.left = event.clientX + 15 + 'px';
        hoverText.style.top = event.clientY + 'px';
    } else {
        // Update hover text position if we're still hovering over the same marker
        hoverText.style.left = event.clientX + 15 + 'px';
        hoverText.style.top = event.clientY + 'px';
    }
}

// Add this helper function to properly reset marker state
function resetMarkerState(marker) {
    if (marker) {
        marker.material.map = marker.userData.defaultTexture;
        marker.material.needsUpdate = true;
        marker.scale.setScalar(1);
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
                const currentMarker = intersects[0].object;
                openProjectModal(project, () => {
                    // Callback function that runs when modal closes
                    if (hoveredMarker) {
                        hoveredMarker.material.map = hoveredMarker.userData.defaultTexture;
                        hoveredMarker.material.needsUpdate = true;
                        hoveredMarker.scale.setScalar(1);
                        hoveredMarker = null;
                    }
                });
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
        if (hoveredMarker) {
            hoveredMarker.material.map = hoveredMarker.userData.defaultTexture;
            hoveredMarker.material.needsUpdate = true;
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

        currentZoom += (targetZoom - currentZoom) * ZOOM_SMOOTHING;
        camera.position.z = currentZoom;

        renderer.render(scene, camera);
    }

    function resizeHandler() {
        const width = window.innerWidth * 0.9;
        const height = window.innerHeight * 0.7;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function cleanup() {
        document.body.removeChild(hoverText);
    }

    return {
        renderer,
        animate,
        resizeHandler,
        cleanup,
        getMarkerObjects: () => markerObjects,
        updateMarkersForSearch,
        resetAllMarkers,
        filterMarkersByKeyword
    };
}

const projects = [
    { 
        id: 1, 
        title: 'SLS WOW HOTEL APARTMENT', 
        abbr: 'SLS', 
        image: "./ICON/SLS.svg", // Updated path
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b6964d2f-924b-44d0-903d-f6a28fdab2fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=3df265ea-93df-4cb5-812f-918de24560e4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2015, 
        client: 'WOW INVEST. LIMITED',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        hoverImage: "./hover/SLS.png",
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
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ff6a656d-b0de-48cc-b510-2d6124a61fe1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
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
        image: "./ICON/RAD.svg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a92700b-869b-421d-b104-9f30d88488f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=07554c31-c2b6-4fac-b65d-e5476b5b9d61&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'AL REEM REAL ESTATE DEVELOPMENT EST',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        hoverImage: "./hover/RAD.png",
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e4d1ebef-5ef6-488b-8032-9d860ba10da5',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e2c9f501-ef4c-46d0-810c-ce9b80d4f317',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFkaXNzb24gQmx1IEhvdGVsIEFwYXJ0bWVudCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=984f3406-3ecd-478b-9fde-d44a05f862c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
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
        title: 'W HOTEL (LMMS HOTEL EXTENSION)', 
        abbr: 'WMS', 
        image: "./ICON/W.svg",
        hoverImage: "./hover/WMS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7894ce44-5ab4-4be9-8db5-6c9f34131b02&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7cdde790-237a-4be8-93e7-0c80b3b09493&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'WASL',
        program: 'HOSPITALITY',
        typology: 'HOSPITALITY',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/0aca36be-3fa6-4355-8339-82172ac0f026',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/ff59c6e9-5da5-4560-96cd-8a2a2f322766',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTE1NUyBIb3RlbCBFeHRlbnNpb24iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/70fdb2b2-6644-4ae6-bf76-e624eade326e',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a2b3206f-37d8-4589-939b-898362ec0dd7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=3fb85446-b10c-4154-b67e-91551b2d2fd0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=40695073-a66e-4b73-ad1b-b308899e08e1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dfaf9674-a17b-48cc-ae6e-c83f2a8b8108&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5467ae05-cf9b-467f-bb4d-31b399477c9e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 4, 
        title: 'CITY GATEWAYS & AL BATEEN BEACH', 
        abbr: 'CGA', 
        image: "./ICON/CGA.svg",
        hoverImage: "./hover/CGA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ddccb4a-8bf0-49d8-ac18-0434bc5212d8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=ee0b8503-cada-42d1-b602-03d9270d2bff&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'MODON',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN', 
        location: 'ABU DHABI',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/navigate/file/9394a6ef-0cd6-4657-baa6-94e4c7ff979e',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/611966b5-0420-4a5f-a598-089fc3c639a1',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8e8427d1-6334-423b-b3bb-8607792ca37b',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a2b3206f-37d8-4589-939b-898362ec0dd7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4ed1cf84-65eb-484e-a490-14aa7e89b172&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=eb158bae-a2de-4e30-a873-6ba691fbc78f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c05163cc-4d1d-42d7-89dc-1c12893e6984&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=64631a51-3a3a-41d0-aae1-46b092d7053c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 5, 
        title: 'SILVER BEACH', 
        abbr: 'SVB', 
        image: "./ICON/SVB.svg",
        hoverImage: "./hover/SVB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=76310ef9-9995-4d0f-a1da-3ba406972810&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=8a44fdfb-9271-47a9-a9f6-1fc56bd1342b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'NEOM',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN', 
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a2ee6fcb-d2c4-4d40-9649-8f5c2fbfe487',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8d372f36-ec5c-4a3d-a79a-282f999540d7',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/3829cb85-701f-4bcc-9169-3c3156bb4576',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d40b4f87-169f-4eb6-902d-f690580c0d3d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=5481d31e-99f0-4d48-8b77-c33dc88a42a2&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cee8b079-6d0f-48d7-94ef-731a9aa5d56f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a17b177d-07ff-4611-8bc1-c6f221878297&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=173a0110-d12c-430f-bb37-a2d81677de75&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3a231a0c-2f30-46e9-99d7-2cff92b9ad03&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 6, 
        title: 'RUA AL HARAM 2020', 
        abbr: 'RUH', 
        image: "./ICON/RUA.svg",
        hoverImage: "./hover/RUA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1866152a-6a90-42ff-8862-73df144a1d70&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0b78105d-3aef-45bb-9915-0c90c0665321&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'PIF',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/efdc2ace-9f9c-41eb-a770-e563772400c7',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4727b812-76b4-4c00-a7b1-37da20aa7bb3',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/0c5484bf-8f57-424f-ae56-73b5ba40c3ff',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=96c8dca5-489c-443c-a04d-7c25760d3f19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=48efad4c-9c5b-4f48-8ef0-b87f8fb9a351&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6429b569-094e-4e76-b9e1-d32f8e8478ab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8e0ed4b3-2054-44fc-aada-689ff568adb6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=939fc3d4-5a99-48f3-9bd2-a4dad2855232&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=53de8ece-eb85-4b33-9fbb-c48883fe05f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 7, 
        title: 'TROJENA SKI VILLAGE', 
        abbr: 'SKI', 
        image: "./ICON/SKI.svg",
        hoverImage: "./hover/SKI.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=98b3a94f-1eca-418e-8c4a-410881bbbbdf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=fb59c183-a144-43c9-9a8b-de1bda0d8240&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'NEOM',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/92567bc4-8f2c-41ad-9c0b-30f85dd885d2',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/25b950a0-5aab-4b36-88d4-cbc424afb93a',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVHJvamVuYSBTa2kgVmlsbGFnZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/48beb068-37f2-4471-92ad-a054f40823f8',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d8827888-1bf6-48c1-b465-51c5be93ed4b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=1d113893-8281-43d2-961d-06ecfb8bcdf1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=aed83d29-d36d-42d1-812d-3dfa74d9886e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=035f8cd7-f310-4d8c-b56a-916413f7df47&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3896a67f-953c-4647-9a1a-7dd209eb1979&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b0178749-1db0-46ab-9837-d540573cb74a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 8, 
        title: 'MINA ZAYED', 
        abbr: 'MNZ', 
        image: "./ICON/MNZ.svg",
        hoverImage: "./hover/MNZ.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2fceb334-d42f-4ea4-ac52-515d18e8341d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=c80019c1-bfac-4109-b4dc-bf36a0d89c82&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'ALDAR',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'ABU DHABI',
        scale: 'XL', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e8c40ef4-3933-435c-a549-20c03210e9cb',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/78984ef1-f128-4fc4-9ac3-efdce60f41a5',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f9f1878c-9865-4a16-bc74-0f9035c8e155&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4c56f5a9-aa03-4e7b-967a-697ebcbb81dc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c885916b-9b3b-4bc0-ab23-73089395a670&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=02308a32-bd95-4892-a3c9-053126e83c31&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ce8048f2-aa9c-4208-9348-4cb99d0da03b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=0300225c-ce2e-4926-bcf7-d36387bfb688&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3fe1c75d-3066-4412-8798-b7bb16976187&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 9, 
        title: 'PROJECT ELEPHANT', 
        abbr: 'ELP', 
        image: "./ICON/ELP.svg",
        hoverImage: "./hover/ELP.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=40886ea5-bda5-4448-8cd9-a8eeb4c50bab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7d40b31f-99d7-49e9-a68e-0a17907cbd36&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'PIF',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8c5deed0-ec71-4d7a-a666-4cc4b5ce9526',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/b07701f0-69b3-4cfe-bc95-561b5ab815ce',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUHJvamVjdCBFbGVwaGFudCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ddd5539b-579d-4b8d-91b2-e6541c67739c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=d7e6fe15-1643-4e9c-8e34-882f07f8d482&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c63f3133-80f1-4be3-8295-69a296044510&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=aba13775-a9b5-4e09-8920-44aec30c3b6e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=52ebbd42-6db5-4c96-90d8-2b132955f0ec&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 10, 
        title: 'MODON CALA IRIS ', 
        abbr: 'MOR', 
        image: "./ICON/MOR.svg",
        hoverImage: "./hover/MOR.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c9bdad2f-b266-4834-af53-5bd383057e19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=60070b0d-e6c6-4c7d-8669-20a42ac6bd39&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'MODON PROPERTIES',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'MOROCCO',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f73613da-9d5f-4abf-bfb2-1cdd984aea64',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/52147e24-8515-4105-85e4-f6bd67fbc7b5',
        animationLink: 'https://aedasme.egnyte.com/navigate/file/d9933f9c-2c79-47fc-92e3-e3436315c793',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7721f355-e944-412b-be79-bc7b266e145a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=401f307f-35a8-4cb9-9290-e221a09830cc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=14bfb658-a823-4dc4-a3d7-eca1f39ef987&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=88291ab8-3e5b-4848-9a40-a9f7c6542d52&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=859d3893-9f1e-466a-b8a6-2ddd960a507d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7c82dcea-1377-447a-a695-4478f0709aa8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=9c139c98-4f46-4590-b502-3497362d2d10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 11, 
        title: 'JEBEL ALI VILLAGE P2', 
        abbr: 'JA2', 
        image: "./ICON/JA2.svg",
        hoverImage: "./hover/JA2.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2f1ab495-83b0-4871-ab42-ed854f2d9f47&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=497f40c7-f80e-4d72-bd20-5bf5997380b0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'WASL',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/06ed9c99-68c2-43e6-8e45-f97cbb9eadb2',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de6dc567-a442-4e3a-8406-eb7b2cbfb4ef',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSmViZWwgQWxpIFZpbGxhZ2UgUDIiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7a25a4ad-6dae-4953-8e89-d6ec329b707b',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5b4a0885-a329-4369-a931-965bddb1bbfd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=7a980849-345d-4e27-ae8e-f7c2c94b07d3&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=de9166b7-efb9-4437-b90d-57d32a7db710&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=75166aa9-393a-4cad-9605-5806731704a4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3636893f-de17-4f3c-bd85-04554ac15402&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b8b5c93f-d5e0-43c8-bb50-937d89c8041d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 12, 
        title: 'EMAAR VIDA HOTEL', 
        abbr: 'VDA', 
        image: "./ICON/VDA.svg",
        hoverImage: "./hover/VDA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ccab3421-de6d-415c-bc66-f7d9af580fe2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0abd29c9-88cd-4d3d-9917-b96eca0ee9b4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'EMAAR PROPERTIES',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/06ed9c99-68c2-43e6-8e45-f97cbb9eadb2',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de6dc567-a442-4e3a-8406-eb7b2cbfb4ef',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSmViZWwgQWxpIFZpbGxhZ2UgUDIiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7a25a4ad-6dae-4953-8e89-d6ec329b707b',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cee7c481-d5fa-4cf2-a75b-fe9e231b0636&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=d9135396-f72d-47b2-a1bf-4b8ee09641ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=23c54637-597a-4bd9-9b29-40edd59e6862&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b0e878c9-4c63-4fbd-9606-24c2dedfbdcb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=9989c04a-67b8-46ee-9bee-39152bdf5aa2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 13, 
        title: 'GOLF VILLAS', 
        abbr: 'GOLF', 
        image: "./ICON/GFV.svg",
        hoverImage: "./hover/GOLF.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a3cc079e-6020-4e2a-83df-90f53b35ac20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7573d7e5-6acf-4b89-9521-40fe9675633d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL',
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/17290a5a-fbd5-4dfd-baa8-cf339353236a',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/37c048d7-4bee-4f1c-97ee-456c510e8138',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR29sZiBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR29sZiBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d908b598-0188-425b-bbbc-7d2d5f77ee8c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=faab3423-860f-4639-b78b-d44a2f479e4d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=975bded3-46a0-40e0-84b2-a1a15cb84988&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=57eee44f-9e87-4af2-b826-ed2fa22d1de3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5c89ab2f-c41a-4bdb-a007-74e67499c34f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 14, 
        title: 'SIDRA III VILLAS', 
        abbr: 'SID', 
        image: "./ICON/SID.svg",
        hoverImage: "./hover/SID.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1e5e63f2-5fd9-4f83-ab07-22f7a1ecb35f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=01e3b231-a535-4deb-8443-52c46c867542&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL', 
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d52520ab-68f9-4baa-ba66-b3d2d30509ef',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU2lkcmEgSUlJIFZpbGxhcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        linkImages: {
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac47b403-3504-4cc3-a411-e010e7bb192a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=0b3c7919-54ad-4104-bbc2-b8e306c736e1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6ee4f57a-960d-49c7-acb3-8f536d701317&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 15, 
        title: 'ENOC FUTURISTIC RETAIL', 
        abbr: 'ENC', 
        image: "./ICON/ENC.png",
        hoverImage: "./hover/ENC.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=277c2ef0-929c-49e7-9dcc-9551828f1d85&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=84be6e0a-c121-4158-abb9-6a69847780ba&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'ENOC',
        program: 'TRANSPORTATION',
        typology: 'TRANSPORTATION',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/63d790a6-2d7d-43d8-8e77-0dec247129d2',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2da58865-3a61-4f8f-9750-f6b93b022fc9',
        animationLink: 'https://aedasme.egnyte.com/navigate/file/0d056640-259d-4330-ad9a-6d3e9deeb795',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRU5PQyBGdXR1cmlzdGljIFJldGFpbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e055444a-c034-4a0d-95ed-67f2493dc019&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4aeb8a21-511a-442d-b24b-248d08e8922b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a49d9b79-c8aa-41b9-8b63-82cbd0458185&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a78e4625-7921-4b32-bbff-c2ae59180f13&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=71ff0ac4-7d68-48ac-b52a-09b4d26e01a5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 16, 
        title: 'YAS MEDICAL STREET', 
        abbr: 'MED', 
        image: "./ICON/MED.svg",
        hoverImage: "./hover/MED.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7a02a260-ff44-4e7f-b103-cce302af104e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=217f28bf-2510-4efb-ac6f-9073499e115a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'MODON',
        program: 'OTHERS',
        typology: 'MEDICAL STREET',  
        location: 'ABU DHABI',
        scale: 'L', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8780aa5a-153f-4b80-be30-dc467cf560df',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/46738a81-a31a-4402-90a1-11532b0e6c17',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4b4f49e8-2bd9-4389-afe0-bc328640ed62',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5584521c-ec60-4ed4-87c8-9cc35a05b9b7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=382dd6f9-eba0-4f7c-863d-67f1cee0f9b0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6a7edff8-88f6-49a2-8bed-e34cdc40f8d0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=189fa003-5e53-4d52-9220-382928091a10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=470fe44a-21db-4628-9cc8-c523f1b08131&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 17, 
        title: 'NEOM BAY MANSIONS CMP', 
        abbr: 'NBY', 
        image: "./ICON/NBY.svg",
        hoverImage: "./hover/NBY.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=8215a838-d512-42b1-8969-d6b419e10c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e1f64ee0-ffce-43f8-8591-21999050cd0e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'NEOM',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de2e97b3-edfa-4d88-b380-8e6c05e937af',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a0308775-b9b7-463b-85a8-203d1c7f9daa',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/07fdf512-10f9-4f8c-9c1d-1d17cf6b77c7',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b2dee9cc-ad11-429d-9c95-e201f5eeb75d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=9ff320b1-30d8-4f7b-b4ef-fe202bccfc46&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ceba6c6d-fbe9-4352-bca7-fdd79bd108b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1c335a17-0c41-4bab-a3a6-640617d21660&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dc14967a-21ca-48b2-9d38-c04c31c6b120&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=faab77b5-7d08-49f0-9db3-48ccd5b67b29&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 18, 
        title: 'D3 OFFICE', 
        abbr: 'D3O', 
        image: "./ICON/D3O.svg",
        hoverImage: "./hover/D3O.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ed03bc4-0f39-4ce8-9fcc-389645a1aba1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=f3e1773d-3deb-4d4c-be1e-0fe3f8e93f82&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'TEACOM',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'DUBAI,UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/bf117226-a817-4f8b-b362-c9a097d05a80',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F3.%20Office&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgT2ZmaWNlcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/924d9f8c-4c7d-495c-af15-6d77f105404a',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8d94c17b-0f90-4fd6-aa12-3dfc9fdab299',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=852c1ef0-8b14-4346-bf0d-db4dc9b15fdb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=8947c966-7157-4a01-b7cb-16f5e76124f8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bd1ede03-6542-4536-a644-497662563841&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=e8eefd6c-19be-48ca-b1b2-34a2b72b9193&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=47985d95-6738-47bf-b4e5-0196ec9686c0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1a92ae10-0372-4402-bbca-91f3e6dcc281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 19, 
        title: 'HABITAS AL-ULA', 
        abbr: 'HAB', 
        image: "./ICON/HAB.svg",
        hoverImage: "./hover/HAB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=67123175-567e-40d2-9b31-12b3ac7dcd61&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=00036b1d-d9be-469e-98ee-99601b921c95&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'ROYAL COMMISSION FOR AL-ULA',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6c6def1c-a686-46bd-8fd4-81314cc7f046',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSGFiaXRhcyBBbC1VbGEiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c099f89c-2573-4fd1-83a8-6c4fb6c0f001',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSGFiaXRhcyBBbC1VbGEiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=852c1ef0-8b14-4346-bf0d-db4dc9b15fdb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=84c1975f-78f8-4c5e-b85c-4da3cfc35a94&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cfd17305-1860-482c-b454-99db7c559ece&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a148aa2c-ea2d-4b6a-b601-f1f86b87a153&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8cc8979d-8969-45a3-81e9-62200764e856&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1ff83d19-ed48-46c0-bca0-30623d28dc20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=33e0ca6e-38d6-4f09-b80e-3b73ea4c7530&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 20, 
        title: 'ADQ HEADQUARTERS', 
        abbr: 'ADQ', 
        image: "./ICON/ADQ.svg",
        hoverImage: "./hover/ADQ.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ffaa830e-1669-4716-8a4a-71a299fb48c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=4c6b7144-8bef-4d2f-88f7-c7a3d5e67546&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'MODON',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'ABU DHABI',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/e499625d-1b61-4e3b-9203-bebc547227bd',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQURRIEhlYWRxdWFydGVycyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/11512cb1-ed19-43ee-a100-3f16c0799f97',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/70f396cf-5248-402c-a6a7-89ddce0c1b7b',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/5167fd71-351d-4ba1-8202-6ec8b40681e8',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e1afb5b4-bd13-4729-a32b-c71cf8b4e028&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=58497289-a597-416e-b793-03b86daee0d1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=d22a44b1-6800-4ee7-ab66-6ecc7b75d582&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2e2877c4-4286-44aa-b99c-00d445724112&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2a01d626-b5de-4a17-ac6a-3adf6ff8b899&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bb2f6f0a-8c5a-492b-86b3-27f22fca0819&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 21, 
        title: 'WADI SAFAR', 
        abbr: 'WDS', 
        image: "/ICON/WDS.svg",
        hoverImage: "./hover/WDS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=12db4279-9e1f-4af7-b190-c41a24be3c6f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=b7b8542a-df77-4f75-9308-b370c7dfde41&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'DGCL',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6c9bc759-b082-4ead-b143-712e50ab6748',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBXYWRpIFNhZmFyIE9iZXJvaSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2d8772ee-a401-4938-85eb-138f5259a6e3',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBXYWRpIFNhZmFyIE9iZXJvaSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c0509431-0e28-40b7-aec0-6f8b987d0c43&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=9944b61c-4b6e-4917-a777-5089080e63fa&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=53483c75-fe9c-40d3-aedc-61d4639c1283&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=81bab909-db49-4e0f-8c9b-11e99b06030c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cb59b7cb-41d9-4c79-9fd4-c0811eff901d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=daf0e420-7a99-47a5-b3f7-6a77e238825b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 22, 
        title: 'DGCL KING SALMAN SQUARE', 
        abbr: 'KSS', 
        image: "/ICON/KSS.svg",
        hoverImage: "./hover/KSS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=4f92b890-318c-4b4d-a078-685605ca5281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=3e87037d-172f-4c82-97cc-5dcd1cfebed5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'DGCL',
        program: 'OTHERS', 
        typology: 'F&B',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/DGCL%20King%20Salman%20Square/Presentation',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdDTCBLaW5nIFNhbG1hbiBTcXVhcmUiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/11d9e1cf-3587-44ab-a9de-ab4a84838d0d',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdDTCBLaW5nIFNhbG1hbiBTcXVhcmUiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=92f00e77-e954-40db-a640-99420b608719&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=ac7c937a-dfd9-4669-ae81-8b08903843cd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=75be7652-8c28-4145-9496-469dc1b47b9f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=44fec4c6-5222-4d15-877b-1e70c521119e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b3da0aae-3a81-4713-8bba-5c7d82b4ed9f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"        ]
    },
    { 
        id: 23, 
        title: 'THE POINTE DISTRICT', 
        abbr: 'PNT', 
        image: "/ICON/PNT.svg",
        hoverImage: "./hover/PNT.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7f25fdb4-7944-4f92-9bc9-58b3d7208abf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=a454a7dc-b61b-4304-8959-ce2899c00b79&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'NAKHEEL',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'DUBAI, UAE',
        scale: 'XL', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/573aeae0-b896-4b10-85dc-a7e73d113c5e',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d818065b-d0e4-4ce2-a84e-d1a5f10eb80e',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de1ffd02-f5c4-40bd-835c-318d028c49a5',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a50c7014-1991-4400-8784-0571b2c1590d',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVGhlIFBvaW50ZSBEaXN0cmljdCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=358e7509-9e7b-4e6a-80b6-b48888316ccc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=78a67749-1f55-4efd-b595-50471908555e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6e6f4aee-11c0-4bdf-81a7-cab90eed023b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=92cb787d-3e53-42af-9807-264780feb7f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3b2fce39-fcd9-4e5b-9a46-7854b341e8ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=d75e844f-d7de-4e16-8e44-fbbe608d6049&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 24, 
        title: 'D3 RESIDENTIAL', 
        abbr: 'D3R', 
        image: "/ICON/D3R.svg",
        hoverImage: "./hover/D3R.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=fbb6ea8d-5c30-4159-8c7f-5201d680af2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=b4bbc481-4be9-4bab-8703-6384b4c6d41b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'TEACOM',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/905a3def-d48d-474c-bd9f-2796977f58de',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgUmVzaWRlbnRpYWwiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f4d280e4-c184-4c9f-b028-f45f46d281df',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2328a3f8-4bc1-48ee-8ef8-9fffe352cc78',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3665acbe-b261-41ef-8d9f-93d8bd3d2f14&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=ed9bf1b4-0416-4c6b-9749-95b538843daf&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=37f940a9-8b90-4508-9908-40bcaaae8b18&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8320d2b2-91ac-4b1d-bd63-0f6ac3042609&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=71c74601-ffcb-4b66-918e-658ea697d9bd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=655e6b7d-a41a-4997-8d2f-5601c15ad713&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 25, 
        title: 'DGII LANGHAM', 
        abbr: 'LGH', 
        image: "/ICON/LGH.svg",
        hoverImage: "./hover/LGH.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f212ccf5-5eb5-43dc-a847-56ec73afd6c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=58d2abed-a7af-455c-99ad-0a82fdc99579&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'DGCL',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/43dbaf34-4cae-497c-8adc-1f968832d481',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdJSSBMYW5naGFtIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIkRyYXdpbmciXX1d',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e7f1e7c1-0aee-4e7d-acc7-3db2aabbfcb0',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/10799131-7759-4a4e-bf98-423f5e83c27d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a3c7c37-a695-4e7f-9fc9-03da8a0b1e67&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=018feeb7-0fc0-40fd-af97-20aa1a19163b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cc5025be-c8c5-486b-9f53-b8cc4fafa764&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7c043125-698a-49c0-9c48-4a3ef5e9b99e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1876520a-860c-4df5-be23-c37b80987344&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 26, 
        title: 'DIFC PA07A OFFICE BUILDING', 
        abbr: 'FCO', 
        image: "./ICON/FCO.svg",
        hoverImage: "./hover/FCO.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b0e85e3f-768c-4bfa-a77f-ccf5400bef0c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=bcff6053-b422-4f76-a1d3-9575a6dc932b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'DIFC',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/ce2e56d8-5b24-42f4-bb68-1b5bca525d14',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/86c44e5e-4d7b-4291-9258-fa8262c64f03',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=79bc6026-a8b2-4c00-bbdc-fdd1a5bb822c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=5f60c1ec-3bfc-48cf-bd78-679f449b10ee&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8701b52e-9503-4ea3-8b2b-1f99e5893813&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=38c42dc2-acf1-4655-86ef-3faa0dd11471&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a60822cd-d553-441f-86d4-70262948b080&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 27, 
        title: 'DGCL CEC', 
        abbr: 'CEC', 
        image: "./ICON/CEC.svg",
        hoverImage: "./hover/CEC.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b0e85e3f-768c-4bfa-a77f-ccf5400bef0c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=4759f11d-61cb-4783-85fd-9beb7dba005f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'DIFC',
        program: 'OTHERS', 
        typology: 'CONFERENCE CENTER',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/636486d2-a23a-4b5c-8737-26f27646261d',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b81f1d77-78fa-45a6-83ce-16be9dde3567',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/eb64ec72-c18a-4197-bab7-e5f5e1ac0b77',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f4db67c1-4697-4981-a5eb-4e5ddcfd36d6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=f5afab7d-b744-43fe-a985-527a3cd91172&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2044d487-9113-442d-8024-1dbd0dbb2531&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7d035257-3f31-4d7b-95be-47b5d872f463&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dd82e727-3d10-4ada-878c-5fbfe89ea731&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=faf9190f-d083-43a1-8a5e-3e3b17993f6c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 28, 
        title: 'WASL CORE STADIUM', 
        abbr: 'STA', 
        image: "./ICON/STA.svg",
        hoverImage: "./hover/STA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=543961a4-bab9-4a8c-9833-0fbfb6100dc0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=edf5f8ad-09a9-4e32-8974-9fa027014011&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'DIFC',
        program: 'OTHERS', 
        typology: 'STADIUM',  
        location: 'DUABI, UAE',
        scale: 'M', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d2203605-d0fc-4640-bcc5-a3a0d7212aed',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/80032dfc-1bfe-40ea-af68-1ab46ef12ce0',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4dbb3b25-7afe-4186-a7c4-c56d483e743f',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/68b04a2e-a039-4b5a-b645-0da2b1af8e04',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=571c862e-242e-4844-9d01-8fccd175ec81&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=69fc187f-d0ea-40ff-881b-a30cc1e4a1cc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=97d630fc-2a9c-4571-9bf0-dd39aa5aa2d4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=fee049a4-cfb6-48f7-97b4-32207aec7509&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=251a98b6-f4c2-48ba-bfa9-84765f95a534&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 29, 
        title: ' HUDARIYAT VILLAS', 
        abbr: 'HDV', 
        image: "./ICON/HDV.svg",
       coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c38534dc-2fcb-4e9b-8d6d-c9cd82ec3d17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=963352ee-3ef0-4420-80ac-61f34b6cdcde&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'MODON',
        program: 'RESIDENTIAL', 
        typology: ' RESIDENTIAL',
        location: 'ABU DHABI',
        scale: 'S', 
        epoch: 'PRESENT', 
       hoverImage: "./hover/HDV.png",
       presentationLink: 'https://aedasme.egnyte.com/navigate/file/023dc94d-7a99-46d0-be3b-7ccbe8721624',
  
       visualLink: 'https://aedasme.egnyte.com/navigate/folder/70cf89b0-d8ee-4ab9-ab20-e39e363975d2',
       drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gSHVkYXlyaXlhdCBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
       threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F1.%20Residential%2F1B.%20Villa%2FModel&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gSHVkYXlyaXlhdCBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
       linkImages: {
           presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
       descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cdf6af92-6062-4c2f-bfd7-99eb3ed0636b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
       description: {
           paragraph1: "Hudayriyat Residences reimagines resort-style living with a focus on architectural quality and coastal sustainability, drawing inspiration from some of the world’s most iconic seaside developments. The development comprises of three distinct communities—Hudayriyat Quays, Hudayriyat Hills, and Hudayriyat Coast, each with a unique character.",
           paragraph2: "Hudayriyat Quays Villas offer an exclusive waterfront lifestyle, featuring private mansions and villas with direct water access. Thoughtfully positioned second-row villas benefit from proximity to the waterfront while maintaining privacy. The Marina serves as a vibrant social hub, making this district the only water’s edge villa community on the northern side of Hudayriyat Central. With contemporary, clean design elements, the architectural language emphasizes crisp lines, masonry materials, and a neutral palette of whites, greys, and blacks.",
           paragraph3: "The Sunset Cliff Villas are a part of Hudayriyat Coast, located on a cliff edge with breathtaking sunset views and direct access to a private beach. The villas are expressed through fluid, organic forms, cascading terraces, and a harmonious mix of natural materials like timber and glass, offering a tranquil and sophisticated living experience."
        },
       teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
  
       galleryImages: [
           "https://aedasme.egnyte.com/opendocument.do?entryId=022bf0c4-b4c3-4f8d-b18b-9cce68b0f467&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=c74c1170-6335-4a06-80f1-8f0da68bd78b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=843f5bf6-b61d-412b-b300-d31a38861c5e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=ebae6484-df6b-4b79-954e-c2f9ada81740&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=a2ecfd02-ca1e-4e41-bb8f-7fc5118e4250&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
  
    },
    
  { 
    id: 30,
    title: 'RED PALACE',  
    abbr: 'RED', 
    image: "./ICON/RED.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ae6c82e1-2952-4ca5-ab8a-f6bd2ecebd49&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a0acfb98-9db4-447e-8946-575e4fd4abaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'BOUTIQUE GROUP',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/RED.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/f361b7bc-303d-4889-833a-3e0f293516d5',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/3fffb00f-85f6-4b8c-be3c-68073831bc0d',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/f64b117c-fc58-4cb4-b9f0-ae48d1788fb3',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmVkIFBhbGFjZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/ad484fce-ddba-4db1-be99-5f90673d77ce',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=83243eaf-9d1c-4e07-ab20-394f4700aea3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Red Palace, located in the historic Futah district at the heart of old Riyadh, Saudi Arabia, is a culturally significant building that was originally constructed as a gift from King Abdulaziz to his son Crown Prince Saud. It served as a personal residence for King Saud until 1956 before being repurposed and reimagined as a luxury hotel by Aedas.",
        paragraph2: "The project's aim is to promote Saudi Arabian heritage and culture while achieving profitability and financial returns. The Palace's unique architectural design blends traditional and modern elements, featuring a vibrant red terracotta cladding system and a grand entrance leading to a series of courtyards and gardens.",
        paragraph3: "Accommodations include 70 keys of luxurious rooms, suites, and villas, each designed with modern amenities and stylish decor. World-class facilities such as a spa, fitness center, restaurants, and event spaces will offer guests an unforgettable experience."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=0de1cab0-9cd8-4223-aac3-a1bc735fcc17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=285f17f1-9348-429c-9bfc-30cc2be39125&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3f5ff556-7a30-4b96-90b9-f9d1ee1cfae9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dffd9dc1-c2be-4e95-87a0-312388aa8135&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 31,
    title: 'MBC PUBLIC THEATERS',  
    abbr: 'MBC', 
    image: "./ICON/MBC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b185ede2-1c13-40de-95cf-2516df6dcc1c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=0dd3e886-34bc-418b-8143-2f90ed3303fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'MBC',
    program: 'OTHERS', 
    typology: 'THEATER', 
    location:'KSA, SAUDI ARADBIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/MBC.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/2641789c-4173-4bc1-938e-2a240a4b5e73',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4dbb3b25-7afe-4186-a7c4-c56d483e743f',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/e30a6e1d-6f9b-43ae-bf39-31b7cb8af000',
     threeDLink: 'https://aedasme.egnyte.com/navigate/file/8d10af51-31ba-4efb-9673-363b4cb107b6',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=3dd3d0c8-9ab3-4834-ad0c-bce88ac1a95c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The project is the development of the MBC Theatre plot in Diriyah, Saudi Arabia. The project is located within the Diriyah Gateway, a prime location with diverse views of the Wadi, heritage sites, infrastructure, and the gateway.",
        paragraph2: "The project includes a Music Theater and a Broadway Theater, with dedicated spaces for lobbies, ticketing, concessions, restrooms, reception, VIP reception, sales, F&B, staff facilities, storage, and services. ",
        paragraph3: "The project also includes areas for performer support, stage support, and administrative functions. The document provides a detailed program summary, floor plans, and sections to illustrate the spatial organization and flow within the theater complex."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=89d138fd-1818-40d3-911f-03a851c3164e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=28bd05f1-eaca-423a-85c1-78e3184a2226&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e37231cb-bc6c-4398-a4a1-80f9a4b40519&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 32,
    title: 'RIXOS BRANDED RESIDENCE',  
    abbr: 'RIX', 
    image: "./ICON/RIX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=47345831-0b04-4495-b0db-1a099c4aab27&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=ad18a64c-2b96-4761-9e29-2764e082c03f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'EAST & WEST PROPERTIES',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/RIX.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/bfa5767f-a1e5-4b94-b9a3-6a587168830f',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/04c5a512-9193-4f1a-946b-ba02edb2f6d5',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUklYT1MgQnJhbmRlZCBSZXNpZGVuY2UiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/a6ed3d3e-cb5b-473d-ac97-b4fee9262a84',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=adaa2678-ef6c-44b5-b29c-02c2930f0cc0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Rixos Financial Centre Road Residences, redefines Dubai’s skyline as the second tallest residential tower in the city, standing 329 meters tall. As the world’s first standalone Rixos-branded residences, this landmark development offers an architectural experience that fuses urban sophistication with luxury living.",
        paragraph2: "Occupying a corner plot in Downtown Dubai, the tower offers breathtaking views towards Burj Khalifa and Dubai Canal. The tower is divided into three distinct volumes, offering a mix of one-to-four-bedroom apartments and luxurious penthouses. Residents enjoy upscale amenities like rooftop leisure spaces, fitness centers, and world-class entertainment."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=8095fb63-a219-48dd-8bbe-ce171f9b16a8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a41274b-72ea-4daa-8f04-703c6fef607e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3202bfe8-d923-4571-af17-af44a935a356&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=308fcbf5-9052-49e0-9c8b-1e52120547dd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d92ad48a-1ac2-483f-95ea-5cf15b141d72&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 33,
    title: 'LIWA CAMPSITE',  
    abbr: 'LIW', 
    image: "./ICON/LIW.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d7b6a4cf-d5da-4a85-991c-0b8b544e4a93&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=f436e721-85b6-43d3-bc02-fdbc9c9e393c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'MODON',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/LIW.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/647b4287-f475-4bc7-921c-90c1768d0bcd',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/ae7525ae-a7c0-4b13-94c8-5bb13f21213e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dd9b9175-5925-412f-9d7e-fe29485ff592',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=91d5b51a-6b2c-41a4-b921-ceee5dfbe981&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Rixos Financial Centre Road Residences, redefines Dubai’s skyline as the second tallest residential tower in the city, standing 329 meters tall. As the world’s first standalone Rixos-branded residences, this landmark development offers an architectural experience that fuses urban sophistication with luxury living.",
        paragraph2: "Occupying a corner plot in Downtown Dubai, the tower offers breathtaking views towards Burj Khalifa and Dubai Canal. The tower is divided into three distinct volumes, offering a mix of one-to-four-bedroom apartments and luxurious penthouses. Residents enjoy upscale amenities like rooftop leisure spaces, fitness centers, and world-class entertainment."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=17c22476-c765-4744-88d7-b076730bf9a5&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fce5f19d-19d3-4f9f-bd9d-e5d933d91770&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4a208224-b928-416d-bed9-94af58a5eec8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5886e056-7386-4d14-836b-1db4bf99f918&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=440bd23b-60b6-4234-8eed-634d1eda1962&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 34,
    title: 'THE NOOK (WASL GATE PHASE 4)',  
    abbr: 'NOK', 
    image: "./ICON/NOK.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=419d8a25-b964-4b60-8215-909ba96846c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=ca73f420-cca2-4155-abe8-c7dd4608b01a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2018,
    client: 'WASL',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/NOK.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/df0dc95d-f747-4f2b-ae30-7ba50421d813',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2B.%20Branded%20Hotel%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU0xTIFdPVyBIb3RlbCBBcGFydG1lbnQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dc703231-65cf-4e88-a864-e390ea13297e',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=aebec6fe-12f6-4e8c-9bac-9ef7a4b9b62f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Rixos Financial Centre Road Residences, redefines Dubai’s skyline as the second tallest residential tower in the city, standing 329 meters tall. As the world’s first standalone Rixos-branded residences, this landmark development offers an architectural experience that fuses urban sophistication with luxury living.",
        paragraph2: "Occupying a corner plot in Downtown Dubai, the tower offers breathtaking views towards Burj Khalifa and Dubai Canal. The tower is divided into three distinct volumes, offering a mix of one-to-four-bedroom apartments and luxurious penthouses. Residents enjoy upscale amenities like rooftop leisure spaces, fitness centers, and world-class entertainment."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=2d0f04c6-7a73-427c-9d3f-7c2e50040b19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 35,
    title: 'SIX SENSE FALCON NEST',  
    abbr: 'Six', 
    image: "./ICON/SIX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f2ada69d-e5e1-4258-84de-bc9b1becf8fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=272eb7d0-5cff-4afd-a343-8634a2530d56&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/SIX.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/cdbf8753-a84e-4889-8d88-27d1bff01492',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/0cf8ba56-7d0f-4a7d-9651-aa9b4ada226f',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRmFsY29ucyBOZXN0IFNpeCBTZW5zZXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/6816614d-1bc0-4ff9-b0cd-3343a4d27c87',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=919217be-2578-47f7-a62c-31159a0dc24a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph2: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options.",
        paragraph3: " "
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=f1927683-e408-48c6-9896-7257de1a6517&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ab8b72c4-337d-485a-a324-790c27aab99c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=423b10af-23af-4d25-827b-08cece7d9dd6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6b798be1-62a6-4ff8-9fee-45db29f366fc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 36,
    title: 'JEDDAH RENAISSANCE VM',  
    abbr: 'Jed', 
    image: "./ICON/JED.png",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f8a26cc4-7ec9-4f3a-b992-94e898c9cd19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a2186a44-ea11-44f5-9137-0456bda2d923&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'ROSHN',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/JED.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/3310a680-8728-48f4-b680-45f4b0c45493',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4dbb3b25-7afe-4186-a7c4-c56d483e743f',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/11860c71-7b8d-4a3d-abcc-8920d5a34057 ',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSmVkZGFoIFJlbmFpc3NhbmNlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c2436821-b7bb-401a-9e5f-9dbbe81f9a99&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=cea04816-feb1-4618-af3a-de1161656f79&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9a4ff143-70dc-4614-9f84-05cf48c5b5f7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b294cd64-d426-431e-8c59-b1af174d0355&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5386379d-bf74-42e9-af53-0b36529322a8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9ff0d548-ef62-485e-9109-6d3b6a14c682&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e42d2a41-d64d-4190-afbd-4b956328fe31&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"

    ]

},
{ 
    id: 37,
    title: 'DGDA CAPELLA',  
    abbr: 'CAP', 
    image: "./ICON/CAP.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cbded34f-bcc4-433e-a2f3-117a2cff9f89&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=5c45dca9-ae55-4732-bfc2-e75c6b28b68f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/CAP.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/139fdc72-8288-41cc-92a6-4486b1260607',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBDYXBlbGxhIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/1ba469d8-e138-4cf6-89f4-44eb8473707c',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/58aa2999-8e13-4b59-befd-ab35ac140fae',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=72abcc10-4ce2-4cc9-8353-16c052dca496&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=e2f7aa75-d34f-468d-bbe7-0e2551950224&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d9799ae7-e2f6-4b56-9e7d-895a404aad2d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3da27d0c-29fe-4b35-a0ab-c00fd9423ddc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4acf59bc-8ba1-42d7-b71a-3173b1a9cfaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"

    ]

},
{ 
    id: 38, 
    title: 'CORINTHIA RESIDENCE',  
    abbr: 'Cor', 
    image: "./ICON/COR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d430e449-dc16-43b9-98c5-0906da73eb73&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=e81bcf78-cba3-48f5-ab95-d16e72b93fd2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'UNITED DEVELOPMENT CO.',
    program: 'RESIDENTIAL',
    typology: 'RESIDENTIAL', 
    location: 'QATAR',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/COR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/b470d37d-7309-4711-a6d6-a4ec54c61dfd',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/9ac4fb2b-3f5a-4771-b415-390602bbb25c',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQ29yaW50aGlhIFJlc2lkZW5jZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/12d2d573-3fcb-4322-ad93-23950fccdedf',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=819c35e6-b531-47c5-9e2a-88e64cba039e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=b01bb5de-e7e3-4751-a4c1-ba5e16da24b9&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3885ed76-f539-4efa-9398-711717e2bf70&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e369c607-ff4c-458b-9ddc-fdca75c5b49b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=cb31e9a2-e61a-4385-b067-3eb3c3f49df8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d68d3a97-f577-400d-b431-fb02806142d4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]


},

{ 
    id: 39, 
    title: 'DGDA FOUR SEASONS',  
    abbr: '4SN', 
    image: "./ICON/4SN.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2066ffea-8780-4aba-be6d-6247c3f1f2a9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=d4e68a16-7fc1-41b5-99ee-bf6a1e1a6907&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'DGCL',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/4SN.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9b972212-21a0-437b-ad3c-b0d5ab97eda3',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/24d0beeb-3be3-479f-a4bf-b69ef585975b',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBGb3VyIFNlYXNvbnMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/34651a21-3d42-412f-9659-df6ba953ebbd',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=e8be0ef9-3d08-4631-aa11-9ab2569b65a3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=4f40a556-a6a9-404d-bb46-69c38b8438c1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=676e2c72-a271-493e-9d00-e84d705000dd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7a2effcc-9ff0-4822-9a54-1d7c19c4d0f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1eb01e15-f10c-463c-9cfc-e1b60dc64b25&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=aa72aa89-382f-4256-88b8-76a8f88b7c4b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 40, 
    title: 'DGDA ORIENT EXPRESS',  
    abbr: 'OEX', 
    image: "./ICON/OEX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f7418820-dd45-4aa0-887c-1e400a683b20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=636a90fb-dadf-4db6-9fcb-6e60aed2f1ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'DGCL',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/OEX.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/903417ec-3e83-4c97-a6b7-a040d9262ad4',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/36e566aa-958f-4a60-8640-143f551f6246',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBPcmllbnQgRXhwcmVzcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBPcmllbnQgRXhwcmVzcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=734040e7-7134-4f84-ad77-e91b5a069364&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=3966797f-33c0-4b91-af22-d26025246c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=af7219a6-2bae-45f7-a952-52f3818b35f0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ee1eefbf-ea5f-48a2-827b-4cd268214e86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a6b585d-ab33-41a7-9236-de0b3b4c1b2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 41, 
    title: 'FOUR SEASONS OMAN',  
    abbr: '4SO', 
    image: "./ICON/4SO.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f7418820-dd45-4aa0-887c-1e400a683b20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=59996ffa-c2a9-429e-a9b6-e29b9dae4170&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'OMRAN GROUP',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'MUSCAT',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/4SO.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c1985eb4-7bac-4144-94bd-373e5ad35ebf',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/65bd6317-2c4d-4833-8db5-5bb8e59c5b3b',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2A.%20Hotel%20%26%20Resort%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRm91ciBTZWFzb25zIE9tYW4iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/bd70a130-f23b-4760-97d0-de12a3594bc5',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=734040e7-7134-4f84-ad77-e91b5a069364&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=3966797f-33c0-4b91-af22-d26025246c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=af7219a6-2bae-45f7-a952-52f3818b35f0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ee1eefbf-ea5f-48a2-827b-4cd268214e86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a6b585d-ab33-41a7-9236-de0b3b4c1b2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 42, 
    title: 'WADI TAYYIB GOA',  
    abbr: 'WDT', 
    image: "./ICON/WDT.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=888c523b-5a22-4eb2-b7ad-6edbe1b08a9a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=fe2785b8-4044-4891-9943-db744cc7cc43&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'NEOM',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/WDT.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/21cc6fee-e45d-4b38-ae98-8fb0ed555c46',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/438bcd94-6e52-4316-929d-28cfb6841ddb',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR09BIFdhZGkgVGF5eWliIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=08046d11-a41b-4ab3-8a8a-036544344b76&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
        paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
        paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=03f5a5c1-2b4c-4484-a46e-7cd635adb7ba&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=def60ca2-4aed-44e2-b58a-bdebc64c666e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e4f2aee9-2774-47fb-b5fa-9947e73b3eb7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9e8cb034-5514-47a7-9e81-bf5a4dfce3c2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=74aa1dac-18f9-436d-b422-d36b32b49e73&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=aa4d31d6-af8d-468e-817b-def14d1e820f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 43, 
    title: 'MAF CCMI',  
    abbr: 'MIR', 
    image: "./ICON/MIR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=92471fc4-1dfa-4125-a11c-e976b3424194&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=40e48dbd-f960-4054-a274-8de9fbd63e49&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'MAJID AL FUTTAIM PROPERTIES',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'DUBAI, UAE',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/MIR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/1e4d5a64-86c1-4b5d-9c55-66fa18b2088a',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/2144a03f-478c-41a3-9c0e-e5e5454c030d',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index%2F1.%20Residential%2F1A.%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTUFGIENDTUkiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=cc5d2f93-1d6e-4040-ad94-dd60fe3cdc56&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "With direct access to the Grand Boulevard Anchor, the Hotel provides stunning views of the Opera and Wadi Hanifa. Nestled close to the At Turaif UNESCO World Heritage Site, the development spans 22,000 sqm of GFA and includes a 200-key hotel, a club, a culinary school, a rooftop pool deck, and a signature restaurant.",
        paragraph2: "The architectural concept emphasizes a duality between formal and organic design elements. The Boulevard-facing façade mirrors the discipline of French urban design, while the plaza-facing façade adopts a natural, wadi-inspired form. The expanded plaza creates an elevated experience, framing the Opera as the centrepiece and cascading into an Urban Amphitheatre, where the hotel rooms provide the best seats for this theatrical arrangement.",
        paragraph3: "Terraces enriched with over 15 species of local vegetation, sophisticated detailing, and natural materials add depth to the room experience. The inclusion of a vertical garden redefines urban living by offering tranquillity, privacy, and a unique connection to the surrounding environment, ensuring guests feel both at peace and immersed in the city's essence."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=6e73d33d-b9f0-4f90-8f01-7fad0fa5c25e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=cc02b48c-e152-4a18-8361-335a47c99d3d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=306e7204-759f-4415-a969-c3246ebbc0f8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 44, 
    title: 'PIF INNOVATION HUB DESIGN',  
    abbr: 'Inv', 
    image: "./ICON/INV.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac3a721c-a05b-4320-9cdc-acaae165aca5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=bd1ade04-a796-4cbc-945f-9a25c1acf9d6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024, 
    client: 'PUBLIC FUND INVESTMENT',
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/INV.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/folder/35d18d5e-a557-4ad1-9a4b-c047d86e4c7d',
    animationLink: 'https://aedasme.egnyte.com/navigate/folder/f4d44ad6-a5c3-4cac-9dab-20cc92141bc5',
    visualLink: 'https://aedasme.egnyte.com/navigate/folder/603d9b39-1ebe-46ed-aee5-7a699f9d74a2',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUElGIElubm92YXRpb24gSHViIERlc2lnbiJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=339a74ef-d20c-4867-b126-60e29ed07604&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The PIF Innovation Hub in Saudi Arabia is a groundbreaking architectural marvel designed to redefine the future of work and innovation. Featuring dynamic, moving architecture, the building symbolizes adaptability and progress, with its shifting forms responding to functional and environmental needs. The design integrates advanced technologies, sustainable materials, and a futuristic aesthetic, reflecting Saudi Arabia’s commitment to leading global innovation.",
        paragraph2: "Inside, the hub offers a collaborative environment tailored for creativity and technological breakthroughs. Open-plan workspaces, state-of-the-art labs, and immersive digital interfaces foster a seamless interaction between people and technology. The moving architecture allows spaces to transform dynamically, accommodating diverse activities and enhancing flexibility for the ever-evolving needs of its users.",
        paragraph3: "Set amidst a vibrant urban landscape, the PIF Innovation Hub embodies the vision of a sustainable and tech-forward future. With its bold design and cutting-edge functionality, it serves as a beacon for innovation, attracting global talent and shaping the future of industries in Saudi Arabia and beyond."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=34425893-a96f-4b13-90ed-58ba92dfcac2&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=698cdbe0-cca7-414e-b296-9b4d945fc004&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=559d9b58-3c5e-4a49-91d4-1f4eb982e28b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 44, 
    title: 'THE CUBE',  
    abbr: 'CUB', 
    image: "./ICON/CUB.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d398e4ae-3b3d-405e-833f-ad58ce528705&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=1d9373bc-2f45-48d4-a8d3-be833b4a5167&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024, 
    client: 'NEOM',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/CUB.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f07e96c3-6a0d-4d7b-b5c6-1229f881e726',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/6eaee40c-7e7d-45d0-ab01-dc5fc987e307',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=087b2be0-0132-44ea-ad7f-337cf38d9185&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The PIF Innovation Hub in Saudi Arabia is a groundbreaking architectural marvel designed to redefine the future of work and innovation. Featuring dynamic, moving architecture, the building symbolizes adaptability and progress, with its shifting forms responding to functional and environmental needs. The design integrates advanced technologies, sustainable materials, and a futuristic aesthetic, reflecting Saudi Arabia’s commitment to leading global innovation.",
        paragraph2: "Inside, the hub offers a collaborative environment tailored for creativity and technological breakthroughs. Open-plan workspaces, state-of-the-art labs, and immersive digital interfaces foster a seamless interaction between people and technology. The moving architecture allows spaces to transform dynamically, accommodating diverse activities and enhancing flexibility for the ever-evolving needs of its users.",
        paragraph3: "Set amidst a vibrant urban landscape, the PIF Innovation Hub embodies the vision of a sustainable and tech-forward future. With its bold design and cutting-edge functionality, it serves as a beacon for innovation, attracting global talent and shaping the future of industries in Saudi Arabia and beyond."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=487f3eac-f51b-4161-8a21-272ec6f6d6b1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dbce05ca-46a8-4f2c-92c4-129ceba51598&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4d7c8fc4-ba9e-4d80-a90d-e07146e62b45&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
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
        getHeader: project => project.abbr[0]
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
    document.getElementById('projectTypologyValue').textContent = project.typology || 'N/A';

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
        grid.style.width = '100%';
        grid.style.height = '80vh';
        grid.style.position = 'relative';
        grid.style.overflow = 'hidden';
        grid.style.margin = 'auto';
        grid.style.marginTop = '2rem';
    
        const { renderer, animate, resizeHandler } = createGlobe();
        grid.appendChild(renderer.domElement);
        
        animate();
        
        window.addEventListener('resize', resizeHandler);
        
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


    if (activeFilter === 'PROGRAMMATIC') {
        const epochs = ['PAST', 'PRESENT', 'FUTURE'];
        const programs = filterConfigs[activeFilter].headers;
    
        programs.forEach(program => {
            const programSection = document.createElement('div');
            programSection.className = 'program-section';
        
            const epochColumnsContainer = document.createElement('div');
            epochColumnsContainer.className = 'epoch-columns';
        
            // Calculate width for each epoch column
            const epochColumnWidth = getColumnWidth(filterConfigs[activeFilter].headers.length * 3) * 0.8;
        
            epochs.forEach(epoch => {
                const epochColumn = document.createElement('div');
                epochColumn.className = 'epoch-column';
                epochColumn.style.width = `${epochColumnWidth}px`;  // This needs to stay in JS since it's calculated
        
                const projectStack = document.createElement('div');
                projectStack.className = 'project-stack';
        
                const filteredProjects = projects.filter(
                    project => project.program === program && project.epoch === epoch
                );
        
                filteredProjects.forEach(project => {
                    const projectIcon = createProjectIcon(project, activeFilter);
                    projectStack.appendChild(projectIcon);
                });
        
                epochColumn.appendChild(projectStack);
                epochColumnsContainer.appendChild(epochColumn);
            });
        
            const programHeader = document.createElement('div');
            programHeader.className = 'header program-header';
            programHeader.textContent = program;
            programHeader.style.width = `${epochColumnWidth * 3 + 32}px`;  // This needs to stay in JS since it's calculated
        
            programSection.appendChild(epochColumnsContainer);
            programSection.appendChild(programHeader);
            grid.appendChild(programSection);
        });
    

    } else {
        // Original layout for other filters
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
            });

            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = header;

            column.appendChild(projectStack);
            column.appendChild(headerDiv);
            grid.appendChild(column);
        });
    }

    // Animation handling
    const newIcons = Array.from(grid.querySelectorAll('.project-icon'));
    newIcons.forEach(icon => {
        const layoutId = icon.dataset.layoutId;
        const rect = icon.getBoundingClientRect();
        const oldPos = oldPositions.get(layoutId);

        if (oldPos) {
            const deltaX = oldPos.left - rect.left;
            const deltaY = oldPos.top - rect.top;
            const scaleX = oldPos.width / rect.width;
            const scaleY = oldPos.height / rect.height;

            icon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
            icon.style.opacity = '0';

            requestAnimationFrame(() => {
                icon.style.transform = 'translate(0, 0) scale(1, 1)';
                icon.style.opacity = '1';
                icon.classList.add('transitioning');
            });
        } else {
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

document.addEventListener("DOMContentLoaded", function () {
    const mainSearchInput = document.getElementById("mainSearchInput");
    const searchContent = document.getElementById("searchContent");
    const searchIcon = document.querySelector(".search-icon");

    // List of predefined keywords for auto-fill
    const suggestions = ["HIGH-RISE", "AWARDED", "CULTURAL", "RESIDENTIAL", "HOSPITALITY", "INTERIOR", "BUILT"];

    // Toggle search input visibility when clicking the search icon
    searchIcon.addEventListener("click", function() {
        mainSearchInput.classList.toggle("visible");
        if (mainSearchInput.classList.contains("visible")) {
            mainSearchInput.focus();
        } else {
            searchContent.style.display = "none";
        }
    });

    mainSearchInput.addEventListener("input", function() {
        const query = mainSearchInput.value.toLowerCase();
        updateSearchResults(query);
    });

    function updateSearchResults(query) {
        searchContent.innerHTML = "";
        searchContent.style.display = query ? "block" : "none";

        if (!query) {
            showAllProjects();
            return;
        }

        const displayedResults = new Set();
        const matchingProjects = new Set();

        // Search through projects
        projects.forEach(project => {
            if (project.title.toLowerCase().includes(query) ||
                project.typology?.toLowerCase().includes(query) ||
                project.program?.toLowerCase().includes(query) ||
                project.location?.toLowerCase().includes(query)) {

                matchingProjects.add(project);

                if (!displayedResults.has(project.title)) {
                    displayedResults.add(project.title);
                    const result = createSearchResult(project);
                    searchContent.appendChild(result);
                }
            }
        });

        // Add keyword suggestions
        suggestions.forEach(keyword => {
            if (keyword.toLowerCase().includes(query) && !displayedResults.has(keyword)) {
                displayedResults.add(keyword);
                const result = createSearchResult(null, keyword);
                searchContent.appendChild(result);
            }
        });

        // Update project visibility
        updateProjectVisibility(matchingProjects);
    }

    function createSearchResult(project, keyword = null) {
        const result = document.createElement("div");
        result.classList.add("search-result");

        if (keyword) {
            result.textContent = keyword;
            result.addEventListener("click", () => {
                mainSearchInput.value = keyword;
                filterProjectsByKeyword(keyword);
            });
        } else {
            result.textContent = project.title;
            result.addEventListener("click", () => {
                openProjectModal(project);
                mainSearchInput.value = "";
                searchContent.style.display = "none";
            });
        }

        return result;
    }

    function showAllProjects() {
        document.querySelectorAll('.project-icon').forEach(icon => {
            icon.style.display = "";
            icon.style.visibility = "visible";
            icon.style.position = "relative";
        });
    }

    function updateProjectVisibility(matchingProjects) {
        document.querySelectorAll('.project-icon').forEach(icon => {
            const projectId = icon.dataset.layoutId.split('-')[1];
            const project = projects.find(p => p.id === parseInt(projectId));
            
            if (matchingProjects.has(project)) {
                icon.style.display = "";
                icon.style.visibility = "visible";
                icon.style.position = "relative";
            } else {
                icon.style.display = "none";
                icon.style.visibility = "hidden";
                icon.style.position = "absolute";
            }
        });
    }

    function filterProjectsByKeyword(keyword) {
        const matchingProjects = new Set();
        
        projects.forEach(project => {
            if (project.typology === keyword || 
                project.program === keyword || 
                (keyword === "HIGH-RISE" && project.scale === "XL") ||
                (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                (keyword === "BUILT" && project.epoch === "PRESENT")) {
                matchingProjects.add(project);
            }
        });

        updateProjectVisibility(matchingProjects);
        searchContent.style.display = "none";
    }

document.addEventListener("DOMContentLoaded", function () {
    const mainSearchInput = document.getElementById("mainSearchInput");
    const searchContent = document.getElementById("searchContent");
    const searchIcon = document.querySelector(".search-icon");
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectGrid = document.getElementById('projectGrid');
    let globeInstance = null;
    let activeHoverArea = null;

    // List of predefined keywords for auto-fill
    const suggestions = ["HIGH-RISE", "AWARDED", "CULTURAL", "RESIDENTIAL", "HOSPITALITY", "INTERIOR", "BUILT"];

    // Toggle search input visibility when clicking the search icon
    searchIcon.addEventListener("click", function() {
        mainSearchInput.classList.toggle("visible");
        if (mainSearchInput.classList.contains("visible")) {
            mainSearchInput.focus();
        } else {
            searchContent.style.display = "none";
        }
    });

    mainSearchInput.addEventListener("input", function() {
        const query = mainSearchInput.value.toLowerCase();
        updateSearchResults(query);
    });

    function updateSearchResults(query) {
        searchContent.innerHTML = "";
        searchContent.style.display = query ? "block" : "none";

        if (!query) {
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            if (activeFilter === 'LOCATION' && globeInstance) {
                // Reset all markers on globe
                globeInstance.getMarkerObjects().forEach(marker => {
                    marker.visible = true;
                    marker.scale.setScalar(1);
                    marker.material.opacity = 1;
                });
            } else {
                showAllProjects();
            }
            return;
        }

        const displayedResults = new Set();
        const matchingProjects = new Set();

        // Search through projects
        projects.forEach(project => {
            if (project.title.toLowerCase().includes(query) ||
                project.typology?.toLowerCase().includes(query) ||
                project.program?.toLowerCase().includes(query) ||
                project.location?.toLowerCase().includes(query)) {

                matchingProjects.add(project);

                if (!displayedResults.has(project.title)) {
                    displayedResults.add(project.title);
                    const result = createSearchResult(project);
                    searchContent.appendChild(result);
                }
            }
        });

        // Add keyword suggestions
        suggestions.forEach(keyword => {
            if (keyword.toLowerCase().includes(query) && !displayedResults.has(keyword)) {
                displayedResults.add(keyword);
                const result = createSearchResult(null, keyword);
                searchContent.appendChild(result);
            }
        });

        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        if (activeFilter === 'LOCATION' && globeInstance) {
            updateGlobeMarkersVisibility(matchingProjects);
        } else {
            updateProjectVisibility(matchingProjects);
        }
    }

    function createSearchResult(project, keyword = null) {
        const result = document.createElement("div");
        result.classList.add("search-result");

        if (keyword) {
            result.textContent = keyword;
            result.addEventListener("click", () => {
                mainSearchInput.value = keyword;
                filterProjectsByKeyword(keyword);
            });
        } else {
            result.textContent = project.title;
            result.addEventListener("click", () => {
                openProjectModal(project);
                mainSearchInput.value = "";
                searchContent.style.display = "none";
            });
        }

        return result;
    }

    function showAllProjects() {
        document.querySelectorAll('.project-icon').forEach(icon => {
            icon.style.display = "";
            icon.style.visibility = "visible";
            icon.style.position = "relative";
        });
    }

    function updateProjectVisibility(matchingProjects) {
        document.querySelectorAll('.project-icon').forEach(icon => {
            const projectId = icon.dataset.layoutId.split('-')[1];
            const project = projects.find(p => p.id === parseInt(projectId));
            
            if (matchingProjects.has(project)) {
                icon.style.display = "";
                icon.style.visibility = "visible";
                icon.style.position = "relative";
            } else {
                icon.style.display = "none";
                icon.style.visibility = "hidden";
                icon.style.position = "absolute";
            }
        });
    }

    function updateGlobeMarkersVisibility(matchingProjects) {
        if (!globeInstance) return;
        
        const markers = globeInstance.getMarkerObjects();
        markers.forEach(marker => {
            const project = marker.userData.project;
            if (matchingProjects.has(project)) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
        });
    }

    function filterProjectsByKeyword(keyword) {
        const matchingProjects = new Set();
        
        projects.forEach(project => {
            if (project.typology === keyword || 
                project.program === keyword || 
                (keyword === "HIGH-RISE" && project.scale === "XL") ||
                (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                (keyword === "BUILT" && project.epoch === "PRESENT")) {
                matchingProjects.add(project);
            }
        });

        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        if (activeFilter === 'LOCATION' && globeInstance) {
            updateGlobeMarkersVisibility(matchingProjects);
        } else {
            updateProjectVisibility(matchingProjects);
        }
        
        searchContent.style.display = "none";
    }

    function updateGrid(activeFilter) {
        const grid = document.getElementById('projectGrid');
        const oldIcons = Array.from(grid.querySelectorAll('.project-icon'));
        const oldPositions = new Map();

        oldIcons.forEach(icon => {
            const rect = icon.getBoundingClientRect();
            oldPositions.set(icon.dataset.layoutId, {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            });
        });

        // Clear any existing globe instance
        if (globeInstance) {
            globeInstance.cleanup();
            globeInstance = null;
        }

        // In the updateGrid function, modify the globe creation part:
        if (activeFilter === 'LOCATION') {
            grid.innerHTML = '';
            grid.style.width = '100%';
            grid.style.height = '80vh';
            grid.style.position = 'relative';
            grid.style.overflow = 'hidden';
            grid.style.margin = 'auto';
            grid.style.marginTop = '2rem';

            // Store the globe instance globally
            globeInstance = createGlobe();
            grid.appendChild(globeInstance.renderer.domElement);
            
            globeInstance.animate();
            
            window.addEventListener('resize', globeInstance.resizeHandler);
            
            return;
        }

        // Reset styles for other views
        grid.style.width = '';
        grid.style.height = '';
        grid.style.position = '';
        grid.style.overflow = '';
        grid.style.margin = '';
        grid.style.marginTop = '';

        grid.innerHTML = '';

        // Rest of your existing updateGrid function...
        // (Include the rest of your grid layout logic here)
    }

    // Close search results when clicking outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".search-tab") && !event.target.closest("#searchContent")) {
            mainSearchInput.classList.remove("visible");
            searchContent.style.display = "none";
        }
    });

    // Initialize the search icon functionality
    const searchTab = document.querySelector(".search-tab");
    searchTab.addEventListener("click", function(event) {
        if (event.target.closest(".search-icon")) {
            mainSearchInput.classList.toggle("visible");
            if (mainSearchInput.classList.contains("visible")) {
                mainSearchInput.focus();
            }
        }
    });

    // Add filter button event listeners
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateGrid(button.dataset.filter);
        });
    });

    // Initialize with default view
    updateGrid('CHRONOLOGICAL');
});
});
function createGlobeVisualization() {
    function createGlobe(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        // Scene setup
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, container.offsetWidth / container.offsetHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        renderer.setSize(container.offsetWidth, container.offsetHeight);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        // Globe creation
        const GLOBE_RADIUS = 5;
        const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 50, 50);
        const sphereMaterial = new THREE.MeshBasicMaterial({ // Changed to MeshBasicMaterial
            map: new THREE.TextureLoader().load('Map_lighten.png'),
            transparent: false, // Changed to false
            opacity: 1 // Changed to 1
        });
        const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(globe);
        
        // Initial camera position
        camera.position.z = 12;
        const tooltip = document.createElement('div');
        tooltip.style.position = 'fixed'; // Change to fixed
        tooltip.style.color = 'black';
        tooltip.style.padding = '10px';
        tooltip.style.borderRadius = '5px';
        tooltip.style.display = 'none';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.fontFamily = 'Arial, sans-serif';
        tooltip.style.fontSize = '14px';
        tooltip.style.zIndex = '1000';
        
        // Remove any transform property
        container.appendChild(tooltip);

        // Raycaster for hover detection
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        function createMarker(lat, lng, imagePath, label, size) {
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            
            // Set uniform base size for all markers while preserving aspect ratio
            const BASE_MARKER_SIZE = 0.4;
            
            return new Promise((resolve) => {
                const loader = new THREE.TextureLoader();
                loader.load(imagePath, (texture) => {
                    const spriteMaterial = new THREE.SpriteMaterial({ 
                        map: texture,
                        transparent: true,
                        opacity: 0.9
                    });
                    const sprite = new THREE.Sprite(spriteMaterial);
                    
                    // Calculate base position on globe surface
                    const x = -(GLOBE_RADIUS * Math.sin(phi) * Math.cos(theta));
                    const y = GLOBE_RADIUS * Math.cos(phi);
                    const z = GLOBE_RADIUS * Math.sin(phi) * Math.sin(theta);
                    
                    // Calculate the direction from center to marker position
                    const direction = new THREE.Vector3(x, y, z).normalize();
                    
                    // Get image aspect ratio
                    const imageAspect = texture.image.width / texture.image.height;
                    
                    // Set scale preserving aspect ratio
                    const height = BASE_MARKER_SIZE;
                    const width = height * imageAspect;
                    
                    // Position marker so bottom touches globe
                    const offset = direction.multiplyScalar(GLOBE_RADIUS + height/2);
                    sprite.position.copy(offset);
                    
                    // Apply scale with preserved aspect ratio
                    sprite.scale.set(width, height, 1);
                    
                    sprite.userData = { 
                        label,
                        size,
                        originalScale: {width, height},
                        isHovered: false
                    };
                    
                    resolve(sprite);
                });
            });
        }
// Replace the markerDefinitions array in the previous code with this:
const markerDefinitions = [
    // Southeast Asia
    { lat: 13, lng: 122, image: './PH.png', label: 'Philippines', size: 150 },
    { lat: 15, lng: 101, image: './TH.png', label: 'Thailand', size: 120 },
    
    // Middle East & West Asia
    { lat: 25.276987, lng: 55.296249, image: './UAE.png', label: 'UAE', size: 200 },
    { lat: 15.369445, lng: 44.191006, image: './YEMEN.png', label: 'Yemen', size: 80 },
    { lat: 24.713552, lng: 46.675296, image: './SAUDI.png', label: 'KSA', size: 180 },
    { lat: 33.513807, lng: 42.276528, image: './SYRIA.png', label: 'Syria', size: 75 },
    { lat: 33.888629, lng: 35.495479, image: './LEBANON.png', label: 'Lebanon', size: 90 },
    { lat: 35.715298, lng: 51.404343, image: './IRAN.png', label: 'Iran', size: 160 },
    { lat: 40.409264, lng: 49.867092, image: './AZBJ.png', label: 'Azerbaijan', size: 110 },
    
    // South Asia
    { lat: 28.613939, lng: 77.209021, image: './INDIA.png', label: 'India', size: 250 },
    
    // Europe
    { lat: 51.507351, lng: -0.127758, image: './UK.png', label: 'United Kingdom', size: 180 },
    { lat: 40.416775, lng: -3.703790, image: './SPAIN.png', label: 'Spain', size: 140 },
    { lat: 38.722252, lng: -9.139337, image: './Portugal.png', label: 'Portugal', size: 95 },
    { lat: 41.902784, lng: 12.496366, image: './ITALY.png', label: 'Italy', size: 170 },
    { lat: 53.349805, lng: -6.260310, image: './IRELAND.png', label: 'Ireland', size: 85 },
    { lat: 37.983810, lng: 23.727539, image: './GREECE.png', label: 'Greece', size: 100 },
    
    // Africa
    { lat: 30.033333, lng: 31.233334, image: './EGYPT.png', label: 'Egypt', size: 190 },
    { lat: -25.746111, lng: 28.188056, image: './SOUNTHAFRI.png', label: 'South Africa', size: 160 },
    
    // Oceania
    { lat: -35.280937, lng: 149.130005, image: './AUS.png', label: 'Australia', size: 220 },
    
    // North America
    { lat: 38.907192, lng: -77.036871, image: './US.png', label: 'United States', size: 300 },
    { lat: 45.424721, lng: -75.695000, image: './CAN.png', label: 'Canada', size: 180 },
    
    // South America
    { lat: -33.448890, lng: -70.669265, image: './CHILE.png', label: 'Chile', size: 130 },
    { lat: -34.603684, lng: -58.381559, image: './AGTN.png', label: 'Argentina', size: 145 },
    { lat: -15.826691, lng: -47.921822, image: './BRZ.png', label: 'Brazil', size: 210 }
];

        // Create and add all markers
        Promise.all(markerDefinitions.map(def => 
            createMarker(def.lat, def.lng, def.image, def.label, def.size)
        )).then(markers => {
            markers.forEach(marker => globe.add(marker));
        });

        // Interaction variables
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        let rotationSpeed = { x: 0, y: 0 };
        const dampingFactor = 0.95;

        // Zoom variables
        let currentZoom = camera.position.z;
        const minZoom = 10;
        const maxZoom = 12;

        // Mouse interaction handlers
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousMousePosition = {
                x: e.clientX,
                y: e.clientY
            };
        });

        
        document.addEventListener('mousemove', (e) => {
            const rect = renderer.domElement.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / container.offsetWidth) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / container.offsetHeight) * 2 + 1;
        
            // Handle dragging
            if (isDragging) {
                const deltaMove = {
                    x: e.clientX - previousMousePosition.x,
                    y: e.clientY - previousMousePosition.y
                };
        
                rotationSpeed.x = deltaMove.y * 0.005;
                rotationSpeed.y = deltaMove.x * 0.005;
        
                globe.rotation.x += rotationSpeed.x;
                globe.rotation.y += rotationSpeed.y;
        
                previousMousePosition = {
                    x: e.clientX,
                    y: e.clientY
                };
            }
        
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(globe.children);
        
            // Reset all markers to original scale
            globe.children.forEach((child) => {
                if (child instanceof THREE.Sprite && child.userData.isHovered) {
                    const { width, height } = child.userData.originalScale;
                    child.scale.set(width, height, 1);
                    child.userData.isHovered = false;
                }
            });
        
            if (intersects.length > 0) {
                const marker = intersects[0].object;
                if (marker instanceof THREE.Sprite) {
                    // Scale up marker while preserving aspect ratio
                    const HOVER_SCALE = 2;
                    const { width, height } = marker.userData.originalScale;
                    marker.scale.set(width * HOVER_SCALE, height * HOVER_SCALE, 1);
                    marker.userData.isHovered = true;
            
                    // Update tooltip content and position it at mouse cursor
                    tooltip.innerHTML = `<strong>${marker.userData.label}</strong><br>${marker.userData.size}`;
                    tooltip.style.display = 'block';
                    tooltip.style.left = `${e.clientX + 10}px`; // Offset from cursor
                    tooltip.style.top = `${e.clientY - 10}px`;
                }
            } else {
                tooltip.style.display = 'none';
            }
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Zoom handler
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.5;
            currentZoom += e.deltaY * 0.01 * zoomSpeed;
            currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom));
            camera.position.z = currentZoom;
        }, { passive: false });

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);

            // Update marker rotations to face camera
            globe.children.forEach(child => {
                if (child instanceof THREE.Sprite) {
                    child.quaternion.copy(camera.quaternion);
                }
            });

            renderer.render(scene, camera);
        }

        // Handle window resize
        function handleResize() {
            camera.aspect = container.offsetWidth / container.offsetHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.offsetWidth, container.offsetHeight);
        }

        window.addEventListener('resize', handleResize);

        // Start animation
        animate();

        // Return cleanup function
        return function cleanup() {
            window.removeEventListener('resize', handleResize);
            container.removeChild(renderer.domElement);
            container.removeChild(tooltip);
            sphereGeometry.dispose();
            sphereMaterial.dispose();
            renderer.dispose();
        };
    }

    // Initialize globe when WHO WE ARE tab is opened
    let globeCleanup = null;

    function initGlobe() {
        const whoWeAreTab = document.querySelector('[data-tab="who-we-are"]');
        const whoWeAreContent = document.getElementById('who-we-are');
        
        if (!document.getElementById('globe-container')) {
            const container = document.createElement('div');
            container.id = 'globe-container';
            container.style.width = '100%';
            container.style.height = '400px';
            container.style.marginBottom = '2rem';
            whoWeAreContent.insertBefore(container, whoWeAreContent.firstChild);
        }

        whoWeAreTab.addEventListener('click', () => {
            if (!globeCleanup) {
                globeCleanup = createGlobe('globe-container');
            }
        });

        document.querySelectorAll('.tab-button').forEach(button => {
            if (button !== whoWeAreTab) {
                button.addEventListener('click', () => {
                    if (globeCleanup) {
                        globeCleanup();
                        globeCleanup = null;
                    }
                });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGlobe);
    } else {
        initGlobe();
    }
}
// Start the globe visualization
createGlobeVisualization();