import { Router, Request, Response } from "express";
import { prisma } from "../config/databse";

const router = Router();

/**
 * Compute great-circle distance between two lat/lng points in kilometers.
 */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const publicDoctorSelect = {
  id: true,
  fullName: true,
  specialization: true,
  experienceYears: true,
  consultationFee: true,
  bio: true,
  isVerified: true,
  clinicName: true,
  clinicAddress: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      createdAt: true,
    },
  },
} as const;

/**
 * GET /api/doctors
 * Query params:
 *   q             - free-text matched against fullName + specialization + clinicName + city
 *   name          - matched against fullName
 *   specialization- matched against specialization
 *   city          - matched against city
 *   lat, lng      - reference point for distance calculation (optional)
 *   radiusKm      - if provided with lat/lng, restrict to doctors within that radius
 *   limit         - default 50, max 200
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const {
      q,
      name,
      specialization,
      city,
      lat,
      lng,
      radiusKm,
      limit,
    } = req.query as Record<string, string | undefined>;

    const take = Math.min(Math.max(parseInt(limit ?? "50", 10) || 50, 1), 200);

    const AND: any[] = [];

    if (q && q.trim()) {
      AND.push({
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { specialization: { contains: q, mode: "insensitive" } },
          { clinicName: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
          { clinicAddress: { contains: q, mode: "insensitive" } },
        ],
      });
    }
    if (name && name.trim()) {
      AND.push({ fullName: { contains: name, mode: "insensitive" } });
    }
    if (specialization && specialization.trim()) {
      AND.push({
        specialization: { contains: specialization, mode: "insensitive" },
      });
    }
    if (city && city.trim()) {
      AND.push({ city: { contains: city, mode: "insensitive" } });
    }

    const doctors = await prisma.doctorProfile.findMany({
      where: AND.length ? { AND } : undefined,
      select: publicDoctorSelect,
      take,
      orderBy: { fullName: "asc" },
    });

    let result = doctors as Array<
      (typeof doctors)[number] & { distanceKm?: number }
    >;

    const refLat = lat !== undefined ? parseFloat(lat) : NaN;
    const refLng = lng !== undefined ? parseFloat(lng) : NaN;

    if (!Number.isNaN(refLat) && !Number.isNaN(refLng)) {
      result = result
        .map((d) => {
          if (d.latitude == null || d.longitude == null) {
            return { ...d, distanceKm: undefined };
          }
          return {
            ...d,
            distanceKm: haversineKm(refLat, refLng, d.latitude, d.longitude),
          };
        })
        .sort((a, b) => {
          if (a.distanceKm == null && b.distanceKm == null) return 0;
          if (a.distanceKm == null) return 1;
          if (b.distanceKm == null) return -1;
          return a.distanceKm - b.distanceKm;
        });

      const radius = radiusKm ? parseFloat(radiusKm) : NaN;
      if (!Number.isNaN(radius)) {
        result = result.filter(
          (d) => d.distanceKm !== undefined && d.distanceKm <= radius
        );
      }
    }

    return res.json({ count: result.length, doctors: result });
  } catch (err: any) {
    console.error("GET /doctors error", err);
    return res
      .status(500)
      .json({ error: "Failed to search doctors", message: err.message });
  }
});

/**
 * GET /api/doctors/nearby?lat=..&lng=..&radiusKm=10
 * Convenience wrapper around GET /api/doctors with lat/lng + radius required.
 */
router.get("/nearby", async (req: Request, res: Response) => {
  try {
    const { lat, lng, radiusKm } = req.query as Record<
      string,
      string | undefined
    >;

    const refLat = lat !== undefined ? parseFloat(lat) : NaN;
    const refLng = lng !== undefined ? parseFloat(lng) : NaN;
    const radius = radiusKm ? parseFloat(radiusKm) : 25;

    if (Number.isNaN(refLat) || Number.isNaN(refLng)) {
      return res
        .status(400)
        .json({ error: "lat and lng query params are required" });
    }

    const doctors = await prisma.doctorProfile.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: publicDoctorSelect,
      take: 500,
    });

    const enriched = doctors
      .map((d) => ({
        ...d,
        distanceKm: haversineKm(refLat, refLng, d.latitude!, d.longitude!),
      }))
      .filter((d) => d.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return res.json({ count: enriched.length, doctors: enriched });
  } catch (err: any) {
    console.error("GET /doctors/nearby error", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch nearby doctors", message: err.message });
  }
});

/**
 * GET /api/doctors/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: req.params.id },
      select: publicDoctorSelect,
    });
    if (!doctor) return res.status(404).json({ error: "Doctor not found" });
    return res.json({ doctor });
  } catch (err: any) {
    console.error("GET /doctors/:id error", err);
    return res
      .status(500)
      .json({ error: "Failed to fetch doctor", message: err.message });
  }
});

/**
 * PATCH /api/doctors/:id
 * Update editable fields of a DoctorProfile.
 * body: { fullName?, bio?, consultationFee?, paypalEmail?, experienceYears?,
 *         clinicName?, clinicAddress?, city?, country?, latitude?, longitude? }
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      bio,
      consultationFee,
      paypalEmail,
      experienceYears,
      clinicName,
      clinicAddress,
      city,
      country,
      latitude,
      longitude,
    } = req.body ?? {};

    const data: Record<string, any> = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (bio !== undefined) data.bio = bio;
    if (paypalEmail !== undefined) data.paypalEmail = paypalEmail;
    if (clinicName !== undefined) data.clinicName = clinicName;
    if (clinicAddress !== undefined) data.clinicAddress = clinicAddress;
    if (city !== undefined) data.city = city;
    if (country !== undefined) data.country = country;
    if (consultationFee !== undefined)
      data.consultationFee = Number(consultationFee);
    if (experienceYears !== undefined)
      data.experienceYears = Number(experienceYears);
    if (latitude !== undefined) data.latitude = Number(latitude);
    if (longitude !== undefined) data.longitude = Number(longitude);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    const doctor = await prisma.doctorProfile.update({
      where: { id: req.params.id },
      data,
      select: publicDoctorSelect,
    });

    return res.json({ message: "Profile updated", doctor });
  } catch (err: any) {
    if (err.code === "P2025")
      return res.status(404).json({ error: "Doctor not found" });
    console.error("PATCH /doctors/:id error", err);
    return res
      .status(500)
      .json({ error: "Failed to update profile", message: err.message });
  }
});

export default router;
