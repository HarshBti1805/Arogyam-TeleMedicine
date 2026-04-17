# Arogyam - Doctors Portal

A comprehensive telemedicine platform designed specifically for healthcare professionals. The Doctors Portal provides a modern, intuitive interface for managing patients, appointments, consultations, and medical records.

## 🏥 Overview

Arogyam Doctors Portal is a Next.js-based web application that empowers healthcare professionals to deliver exceptional patient care through digital means. The platform offers a complete suite of tools for modern medical practice management.

## ✨ Features

### Core Functionality
- **Patient Management** - Comprehensive patient records, medical history, and profile management
- **Smart Scheduling** - AI-powered appointment scheduling with automated reminders and conflict detection
- **Teleconsultation** - HD video consultations with screen sharing and virtual waiting rooms
- **E-Prescriptions** - Digital prescription writing with drug interaction checks and e-signature capabilities
- **Medical Records** - Secure cloud storage with instant access to patient history, lab results, and imaging
- **Analytics Dashboard** - Comprehensive analytics and insights to track patient trends and practice performance

### Security & Compliance
- **HIPAA Compliant** - Enterprise-grade security with SOC 2 certification
- **Data Encryption** - End-to-end encryption for all patient data
- **Access Control** - Role-based access control and audit trails

### User Experience
- **Modern UI** - Beautiful, responsive design with smooth animations
- **Dark Mode** - Full dark mode support for comfortable viewing
- **Real-time Updates** - Live notifications and updates
- **Multi-device Access** - Access your practice from any device

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Icons**: Lucide React
- **UI Components**: Radix UI
- **Date Handling**: date-fns
- **Type Safety**: TypeScript

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm/bun
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Tele-Medicine/website
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Set up environment variables (if needed):
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📁 Project Structure

```
website/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Dashboard page
│   ├── login/              # Login page
│   ├── register/           # Registration page
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home/landing page
│   └── globals.css          # Global styles
├── components/             # React components
│   └── ui/                 # Reusable UI components
├── lib/                    # Utility functions
├── public/                 # Static assets
└── package.json            # Dependencies and scripts
```

## 🎨 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Pages

- **Home Page** (`/`) - Landing page with features and benefits
- **Login** (`/login`) - Doctor authentication
- **Register** (`/register`) - New doctor registration
- **Dashboard** (`/dashboard`) - Main practice management interface

### Styling

The project uses Tailwind CSS with custom fonts:
- **Neue Machina** - For headings and bold text
- **Poppins** - For body text and UI elements

Custom CSS variables and utilities are defined in `app/globals.css`.

## 🚢 Deployment

### Vercel (Recommended)

The easiest way to deploy is using [Vercel](https://vercel.com):

1. Push your code to GitHub/GitLab/Bitbucket
2. Import your repository in Vercel
3. Configure environment variables
4. Deploy!

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Other Platforms

The application can be deployed to any platform that supports Next.js:
- **Netlify** - Automatic deployments from Git
- **AWS Amplify** - Full-stack deployment
- **Docker** - Containerized deployment
- **Self-hosted** - Run on your own infrastructure

### Build for Production

```bash
npm run build
npm run start
```

## 🔒 Security Considerations

- Ensure all environment variables are properly configured
- Use HTTPS in production
- Implement proper authentication and authorization
- Regularly update dependencies
- Follow HIPAA compliance guidelines for patient data

## 📝 License

This project is proprietary software for Arogyam.

## 🤝 Contributing

For internal development:
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📞 Support

For technical support or questions:
- Contact the development team
- Check the internal documentation
- Review the codebase for implementation details

## 🎯 Roadmap

- [ ] Enhanced video consultation features
- [ ] Mobile app integration
- [ ] Advanced analytics and reporting
- [ ] Integration with EHR systems
- [ ] Automated billing features
- [ ] Multi-language support

---

**Arogyam** - Transforming healthcare delivery through technology.
