import { Controller, Get, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('Map')
@Controller('map')
export class MapController {
    private readonly mapboxToken: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        this.mapboxToken = this.config.get<string>('MAPBOX_ACCESS_TOKEN', '');
    }

    @Get('clinics/preview')
    @ApiOperation({
        summary: 'Get nearby clinic previews for map display',
    })
    async getNearbyClinics(
        @Query('latitude') latStr: string,
        @Query('longitude') lngStr: string,
        @Query('radiusKm') radiusStr?: string,
    ) {
        const latitude = parseFloat(latStr);
        const longitude = parseFloat(lngStr);
        const radiusKm = radiusStr ? parseFloat(radiusStr) : 10;

        if (isNaN(latitude) || isNaN(longitude)) {
            return [];
        }

        // Bounding box filter (same approach as job.service.ts)
        const radiusDegrees = radiusKm / 111.32;

        const clinics = await this.prisma.clinicProfile.findMany({
            where: {
                latitude: {
                    gte: latitude - radiusDegrees,
                    lte: latitude + radiusDegrees,
                },
                longitude: {
                    gte: longitude - radiusDegrees,
                    lte: longitude + radiusDegrees,
                },
            },
            select: {
                id: true,
                clinic_name: true,
                address: true,
                latitude: true,
                longitude: true,
                images: true,
                rating_avg: true,
                rating_count: true,
                description: true,
            },
            take: 50,
        });

        // Haversine post-filter for accurate radius
        return clinics.filter((c) => {
            const dLat = ((c.latitude - latitude) * Math.PI) / 180;
            const dLng = ((c.longitude - longitude) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos((latitude * Math.PI) / 180) *
                    Math.cos((c.latitude * Math.PI) / 180) *
                    Math.sin(dLng / 2) ** 2;
            const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return dist <= radiusKm;
        });
    }

    @Get('clinic/:id/preview')
    @ApiOperation({
        summary: 'Get clinic location preview data for map display',
    })
    async getClinicPreview(@Param('id') clinicId: string) {
        const clinic = await this.prisma.clinicProfile.findUnique({
            where: { id: clinicId },
            select: {
                id: true,
                clinic_name: true,
                address: true,
                latitude: true,
                longitude: true,
                images: true,
                rating_avg: true,
                rating_count: true,
                description: true,
                parking_info: true,
            },
        });

        if (!clinic) throw new NotFoundException('Clinic not found');

        // Generate static map URL from Mapbox
        const staticMapUrl = this.mapboxToken
            ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+e74c3c(${clinic.longitude},${clinic.latitude})/${clinic.longitude},${clinic.latitude},15,0/600x400@2x?access_token=${this.mapboxToken}`
            : null;

        return {
            ...clinic,
            staticMapUrl,
            directions: {
                googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`,
                appleMapsUrl: `http://maps.apple.com/?daddr=${clinic.latitude},${clinic.longitude}`,
            },
        };
    }

    @Get('jobs/heatmap')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get job demand heatmap data' })
    async getJobHeatmap() {
        const jobs = await this.prisma.job.findMany({
            where: { status: 'OPEN' },
            select: {
                latitude: true,
                longitude: true,
                specialty_required: true,
            },
        });

        // Group by approximate grid cells for heatmap
        const grid = new Map<string, { lat: number; lng: number; count: number }>();

        jobs.forEach((job) => {
            // Round to ~1km grid
            const key = `${Math.round(job.latitude * 100) / 100},${Math.round(job.longitude * 100) / 100}`;
            const existing = grid.get(key);
            if (existing) {
                existing.count++;
            } else {
                grid.set(key, {
                    lat: Math.round(job.latitude * 100) / 100,
                    lng: Math.round(job.longitude * 100) / 100,
                    count: 1,
                });
            }
        });

        return Array.from(grid.values());
    }

    @Get('search')
    @ApiOperation({ summary: 'Search places using Mapbox Geocoding' })
    async searchPlaces(@Query('q') query: string) {
        if (!this.mapboxToken) return { results: [] };

        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${this.mapboxToken}&country=th&language=th&limit=5`,
        );
        const data = await response.json();

        return {
            results: data.features?.map((f: any) => ({
                id: f.id,
                name: f.place_name,
                latitude: f.center[1],
                longitude: f.center[0],
            })) ?? [],
        };
    }

    @Get('directions')
    @ApiOperation({ summary: 'Get directions between two points' })
    async getDirections(
        @Query('fromLat') fromLat: string,
        @Query('fromLng') fromLng: string,
        @Query('toLat') toLat: string,
        @Query('toLng') toLng: string,
    ) {
        if (!this.mapboxToken) return { duration: null, distance: null };

        const response = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${fromLng},${fromLat};${toLng},${toLat}?access_token=${this.mapboxToken}&overview=full&geometries=geojson`,
        );
        const data = await response.json();
        const route = data.routes?.[0];

        return {
            duration: route?.duration ? Math.round(route.duration / 60) : null, // minutes
            distance: route?.distance
                ? Math.round(route.distance / 100) / 10
                : null, // km
            geometry: route?.geometry ?? null,
        };
    }
}
