'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Stethoscope,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  BadgeCheck,
  Briefcase,
  Building2,
  AlertCircle,
  DollarSign,
  Clock,
} from 'lucide-react';
import { auth, ApiError } from '@/lib/api';
import { saveAuthUser } from '@/lib/auth-storage';
import MapPicker, { type MapPickerValue } from '@/components/ui/map-picker';

const SPECIALIZATIONS = [
  'General Practice',
  'Cardiology',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Psychiatry',
  'Oncology',
  'Gynecology',
  'Ophthalmology',
];

export default function Register() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    licenseNumber: '',
    specialization: '',
    clinicName: '',
    consultationFee: '',
    experienceYears: '',
  });
  const [location, setLocation] = useState<MapPickerValue | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!formData.specialization || !formData.licenseNumber) {
        setError('Please provide your specialization and license number.');
        return;
      }
      setStep(3);
      return;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (step !== 3) {
      goNext();
      return;
    }

    if (!location) {
      setError('Please pick your clinic / hospital location on the map.');
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await auth.registerDoctor({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        specialization: formData.specialization,
        licenseNumber: formData.licenseNumber,
        clinicName: formData.clinicName || undefined,
        clinicAddress: location.address,
        city: location.city,
        country: location.country,
        latitude: location.latitude,
        longitude: location.longitude,
        consultationFee: formData.consultationFee ? Number(formData.consultationFee) : undefined,
        experienceYears: formData.experienceYears ? Number(formData.experienceYears) : undefined,
      });
      saveAuthUser(user);
      router.push('/dashboard');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Registration failed. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader className="text-center pb-2">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="inline-flex mx-auto p-4 bg-neutral-900 rounded-2xl mb-4"
            >
              <Stethoscope className="w-10 h-10 text-white" />
            </motion.div>
            <CardTitle className="text-3xl font-neue-bold text-neutral-900">
              Create doctor account
            </CardTitle>
            <CardDescription className="text-base text-neutral-600">
              Join Arogyam and start managing patients online
            </CardDescription>

            <div className="flex items-center justify-center gap-2 mt-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    s === step
                      ? 'w-8 bg-neutral-900'
                      : s < step
                      ? 'w-8 bg-neutral-500'
                      : 'w-2 bg-neutral-200'
                  }`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {step === 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="Dr. John Smith"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="doctor@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={6}
                        className="w-full pl-12 pr-12 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="At least 6 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Confirm password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="Repeat your password"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Medical license number
                    </label>
                    <div className="relative">
                      <BadgeCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        name="licenseNumber"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="MD12345678"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Specialization
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <select
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleChange}
                        required
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 appearance-none"
                      >
                        <option value="">Select your specialization</option>
                        {SPECIALIZATIONS.map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Clinic / Hospital name (optional)
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                      <input
                        type="text"
                        name="clinicName"
                        value={formData.clinicName}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                        placeholder="Apollo Clinic, City Hospital, etc."
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                        Consultation fee (USD)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="number"
                          name="consultationFee"
                          value={formData.consultationFee}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          required
                          className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                          placeholder="50.00"
                        />
                      </div>
                    </div>

                    <div className="flex-1">
                      <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                        Years of experience
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
                        <input
                          type="number"
                          name="experienceYears"
                          value={formData.experienceYears}
                          onChange={handleChange}
                          min="0"
                          max="60"
                          className="w-full pl-12 pr-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-neutral-400 focus:border-neutral-500 outline-none bg-white text-neutral-900 placeholder:text-neutral-400"
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold font-poppins text-neutral-700 mb-2">
                      Where do you practice?
                    </label>
                    <p className="text-sm text-neutral-500 mb-3">
                      Pin your clinic, hospital or workplace on the map. Patients
                      will use this to find nearby doctors.
                    </p>
                    <MapPicker
                      value={location}
                      onChange={setLocation}
                      height={340}
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-100 border border-neutral-200">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="terms"
                        required
                        className="mt-1 w-4 h-4 text-neutral-900 border-neutral-300 rounded focus:ring-neutral-400"
                      />
                      <label htmlFor="terms" className="text-sm text-neutral-600">
                        I agree to the{' '}
                        <Link href="#" className="text-neutral-900 font-medium hover:underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="#" className="text-neutral-900 font-medium hover:underline">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="flex gap-3">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                    className="flex-1 font-semibold text-neutral-900 hover:bg-neutral-100 hover:text-neutral-900"
                  >
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 font-semibold bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                  ) : step === 3 ? (
                    <>
                      Create account
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-8 text-center"
            >
              <p className="text-neutral-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-neutral-900 font-semibold hover:text-neutral-700 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-6 text-center"
            >
              <Link
                href="/"
                className="text-neutral-500 hover:text-neutral-900 text-sm inline-flex items-center gap-1"
              >
                ← Back to home
              </Link>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
