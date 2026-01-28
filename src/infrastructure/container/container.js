// src/infrastructure/container/container.js
// Dependency Injection Container

class Container {
    constructor() {
        this.services = new Map();
        this.singletons = new Map();
    }

    /**
     * Register a service or factory
     * @param {string} name - Service name
     * @param {Function} factory - Factory function that creates the service
     * @param {boolean} singleton - Whether to create only one instance
     */
    register(name, factory, singleton = false) {
        this.services.set(name, { factory, singleton });
    }

    /**
     * Resolve a service by name
     * @param {string} name - Service name
     * @returns {any} Service instance
     */
    resolve(name) {
        const service = this.services.get(name);

        if (!service) {
            throw new Error(`Service "${name}" not found in container`);
        }

        // Return singleton if already created
        if (service.singleton && this.singletons.has(name)) {
            return this.singletons.get(name);
        }

        // Create instance
        const instance = service.factory(this);

        // Store singleton
        if (service.singleton) {
            this.singletons.set(name, instance);
        }

        return instance;
    }

    /**
     * Check if service is registered
     * @param {string} name - Service name
     * @returns {boolean}
     */
    has(name) {
        return this.services.has(name);
    }

    /**
     * Clear all registrations (for testing)
     */
    clear() {
        this.services.clear();
        this.singletons.clear();
    }
}

// Export singleton container instance
const container = new Container();

module.exports = container;
