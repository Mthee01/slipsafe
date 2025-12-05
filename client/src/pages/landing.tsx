import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { 
  Camera, 
  FileSearch, 
  Shield, 
  Clock, 
  FileText, 
  Users, 
  Store, 
  ShoppingBag,
  MessageCircle,
  Mail,
  Phone,
  CheckCircle,
  ArrowRight,
  ChevronRight,
  Receipt,
  Briefcase,
  Building2,
  Home,
  PlayCircle,
  Tag,
  HelpCircle,
  QrCode,
  Calendar,
  BarChart3,
  Download,
  ShieldCheck,
  LayoutDashboard,
  LogOut
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import logo from "@assets/SlipSafe Logo_1762888976121.png";

import heroImage from "@assets/stock_images/people_shopping_smar_898ad94a.jpg";
import individualsImage from "@assets/stock_images/person_home_smartpho_ac77842d.jpg";
import smmesImage from "@assets/stock_images/small_business_team__1a1a4439.jpg";
import retailersImage from "@assets/stock_images/customer_service_des_facd2cf3.jpg";
import supportImage from "@assets/stock_images/customer_support_tea_e0473b27.jpg";
import shoppersImage from "@assets/stock_images/people_shopping_smar_702f3744.jpg";
import businessTeamImage from "@assets/stock_images/small_business_team__33e58445.jpg";
import retailServiceImage from "@assets/stock_images/customer_service_des_9a1688d2.jpg";

const DUMMY_USER_COUNT = 1250;

const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
};

function AnimatedCounter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    
    let startTime: number;
    let animationFrame: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

interface LandingSidebarProps {
  isAuthenticated: boolean;
  user: {
    fullName?: string;
    businessName?: string | null;
    activeContext?: string;
    accountType?: string;
  } | null;
  onLogout: () => void;
}

function LandingSidebar({ isAuthenticated, user, onLogout }: LandingSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  
  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleNavAction = (action: () => void) => {
    action();
    closeMobileSidebar();
  };

  const navItems = [
    { icon: Home, label: "Home", action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
    { icon: PlayCircle, label: "How it works", action: () => scrollToSection('how-it-works') },
    { icon: Users, label: "For Individuals", action: () => scrollToSection('for-individuals') },
    { icon: Briefcase, label: "For Businesses", action: () => scrollToSection('for-businesses') },
    { icon: Store, label: "For Retailers", action: () => scrollToSection('for-retailers') },
    { icon: Tag, label: "Pricing", href: "/pricing" },
    { icon: HelpCircle, label: "Help", action: () => scrollToSection('help') },
  ];

  const getDashboardRoute = () => {
    return "/";
  };

  const getDisplayName = () => {
    if (user?.activeContext === "business" && user?.businessName) {
      return user.businessName;
    }
    return user?.fullName || "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Sidebar collapsible="icon" data-testid="landing-sidebar">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center justify-center">
          <img src={logo} alt="SlipSafe" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" data-testid="img-sidebar-logo" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item, index) => (
                <SidebarMenuItem key={index}>
                  {item.href ? (
                    <SidebarMenuButton asChild tooltip={item.label}>
                      <Link href={item.href} onClick={closeMobileSidebar} data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarMenuButton 
                      onClick={() => handleNavAction(item.action!)} 
                      tooltip={item.label}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-3 mb-3 px-2 group-data-[collapsible=icon]:justify-center">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium" data-testid="text-user-name">{getDisplayName()}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.activeContext === "business" ? "Business" : "Personal"}
                </p>
              </div>
            </div>
            <Link href={getDashboardRoute()} onClick={closeMobileSidebar}>
              <Button className="w-full justify-start gap-2" data-testid="button-sidebar-dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Go to Dashboard</span>
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2" 
              onClick={() => { closeMobileSidebar(); onLogout(); }}
              data-testid="button-sidebar-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign Out</span>
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={closeMobileSidebar}>
              <Button variant="ghost" className="w-full justify-start gap-2" data-testid="button-sidebar-sign-in">
                <Users className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Sign In</span>
              </Button>
            </Link>
            <Link href="/register" onClick={closeMobileSidebar}>
              <Button className="w-full justify-start gap-2" data-testid="button-sidebar-get-started">
                <ArrowRight className="h-4 w-4" />
                <span className="group-data-[collapsible=icon]:hidden">Get Started Free</span>
              </Button>
            </Link>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

interface HeroSectionProps {
  isAuthenticated: boolean;
}

function HeroSection({ isAuthenticated }: HeroSectionProps) {
  return (
    <section className="relative py-8 md:py-24 px-4 overflow-hidden" data-testid="section-hero">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-primary/10 to-teal-500/20 md:from-primary/5 md:via-background md:to-primary/10" />
      
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M30 30h10v2H30V30zm0-10h10v2H30V20zm0 20h10v2H30V40zM10 30h10v2H10V30zm0-10h10v2H10V20zm0 20h10v2H10V40z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="absolute top-10 right-4 w-24 h-24 bg-indigo-500/30 rounded-full blur-2xl md:hidden" />
      <div className="absolute bottom-20 left-4 w-32 h-32 bg-teal-500/25 rounded-full blur-3xl md:hidden" />
      <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-primary/20 rounded-full blur-xl md:hidden" />

      <div className="relative max-w-7xl mx-auto">
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-6 lg:gap-12 items-center">
          <motion.div 
            className="space-y-5 md:space-y-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="space-y-3 md:space-y-4">
              <motion.h1 
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                data-testid="text-hero-headline"
              >
                Never lose a slip again.
              </motion.h1>
              <motion.p 
                className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                data-testid="text-hero-subheading"
              >
                SlipSafe turns paper and email receipts into smart, searchable records – with returns, warranties and VAT-ready reports all in one secure app.
              </motion.p>
            </div>

            <motion.div 
              className="flex flex-col sm:flex-row gap-3 sm:gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              {isAuthenticated ? (
                <Link href="/">
                  <Button size="lg" className="w-full sm:w-auto gap-2 hover:scale-105 hover:shadow-lg transition-all bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-primary/90" data-testid="button-hero-dashboard">
                    Go to Dashboard
                    <LayoutDashboard className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto gap-2 hover:scale-105 hover:shadow-lg transition-all bg-gradient-to-r from-indigo-600 to-primary hover:from-indigo-700 hover:to-primary/90" data-testid="button-hero-get-started">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="w-full sm:w-auto hover:scale-105 transition-all border-primary/30 hover:border-primary/50 hover:bg-primary/5" data-testid="button-hero-view-plans">
                  View Business Plans
                </Button>
              </Link>
            </motion.div>

            <motion.div 
              className="flex items-center gap-2 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500">
                <ShieldCheck className="h-3 w-3 text-white" />
              </div>
              <span>Built for SA shoppers & SMMEs</span>
            </motion.div>

            <motion.div 
              className="hidden md:flex flex-wrap gap-2 sm:gap-3 pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <div className="flex items-center gap-2 text-sm bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full border border-indigo-500/20">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Secure storage</span>
              </div>
              <div className="flex items-center gap-2 text-sm bg-teal-500/10 text-teal-700 dark:text-teal-300 px-3 py-1.5 rounded-full border border-teal-500/20">
                <Clock className="h-4 w-4" />
                <span className="font-medium">Smart deadlines</span>
              </div>
              <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20">
                <FileText className="h-4 w-4" />
                <span className="font-medium">VAT exports</span>
              </div>
            </motion.div>

            <motion.div 
              className="pt-1 md:pt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <p className="text-sm text-muted-foreground" data-testid="text-social-proof">
                Join over <span className="font-semibold text-foreground"><AnimatedCounter target={DUMMY_USER_COUNT} /></span> shoppers and businesses already protecting their slips with SlipSafe.
              </p>
            </motion.div>
          </motion.div>

          <motion.div 
            className="relative w-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-transparent z-10 hidden lg:block" />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/30 via-transparent to-teal-900/20 z-[5] rounded-2xl lg:hidden" />
              <img 
                src={heroImage} 
                alt="Diverse group of shoppers using smartphones while shopping"
                className="rounded-2xl shadow-2xl object-cover w-full h-[200px] sm:h-[280px] lg:h-[480px]"
              />
              
              <motion.div 
                className="absolute -bottom-3 left-2 sm:-bottom-6 sm:-left-6 bg-card/95 backdrop-blur-sm border rounded-xl p-3 sm:p-4 shadow-lg z-20"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/15 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium">Return by 15 Jan</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Woolworths - R245.99</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -top-2 right-2 sm:-top-4 sm:-right-4 bg-card/95 backdrop-blur-sm border rounded-xl p-3 sm:p-4 shadow-lg z-20"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                    <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium">Warranty: 2 years</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Ends 15 Dec 2026</p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl hidden lg:block" />
            <div className="absolute -top-8 -left-8 w-24 h-24 bg-primary/30 rounded-full blur-2xl hidden lg:block" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AudiencesSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const audiences = [
    {
      icon: ShoppingBag,
      image: shoppersImage,
      title: "Everyday Shoppers",
      description: "For shoppers who are tired of lost, faded receipts and missing warranties – SlipSafe keeps every slip and guarantee safe, searchable and ready when you need it.",
      decorations: [
        { icon: Receipt, label: "Receipt" },
        { icon: Calendar, label: "14 days" }
      ]
    },
    {
      icon: Briefcase,
      image: businessTeamImage,
      title: "SMMEs",
      description: "For SMMEs who need VAT and spending under control – SlipSafe turns everyday slips into clean, accountant-ready reports.",
      decorations: [
        { icon: BarChart3, label: "VAT 15%" },
        { icon: Download, label: "Export" }
      ]
    },
    {
      icon: Building2,
      image: retailServiceImage,
      title: "Merchants & Retailers",
      description: "For retailers drowning in paper slips, disputes and fraud – SlipSafe turns receipts into verifiable digital records, speeding up returns and unlocking real post-purchase insight.",
      decorations: [
        { icon: QrCode, label: "Verify" },
        { icon: ShieldCheck, label: "Fraud-proof" }
      ]
    }
  ];

  return (
    <section id="audiences" ref={ref} className="py-16 md:py-24 px-4 bg-card/50" data-testid="section-audiences">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-audiences-title">
            Built for real-life receipts – not just perfect systems.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {audiences.map((audience, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.15 }}
            >
              <Card className="h-full overflow-hidden group hover:-translate-y-2 hover:shadow-xl transition-all duration-300" data-testid={`card-audience-${index}`}>
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={audience.image} 
                    alt={audience.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    {audience.decorations.map((dec, i) => (
                      <div key={i} className="flex items-center gap-1 bg-background/90 backdrop-blur px-2 py-1 rounded-full text-xs">
                        <dec.icon className="h-3 w-3 text-primary" />
                        <span>{dec.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <audience.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{audience.title}</h3>
                  <p className="text-muted-foreground text-sm">{audience.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const steps = [
    {
      icon: Camera,
      title: "Capture your receipt",
      description: "Scan with your phone camera, upload a photo or paste an email receipt.",
      color: "bg-blue-500/10 text-blue-600"
    },
    {
      icon: FileSearch,
      title: "SlipSafe reads and organises it",
      description: "Our OCR extracts totals, dates, VAT and return/warranty terms, then files everything by merchant, category and date.",
      color: "bg-purple-500/10 text-purple-600"
    },
    {
      icon: Receipt,
      title: "Use it when it counts",
      description: "Show digital proof at the till, track 'Return by' and 'Warranty ends' dates, export reports or generate verifiable claims.",
      color: "bg-green-500/10 text-green-600"
    }
  ];

  return (
    <section id="how-it-works" ref={ref} className="py-16 md:py-24 px-4" data-testid="section-how-it-works">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-how-title">
            Three simple steps
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div 
              key={index} 
              className="relative"
              initial={{ opacity: 0, x: -30 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              data-testid={`step-${index + 1}`}
            >
              <div className="text-center space-y-4">
                <motion.div 
                  className="relative inline-block"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className={`w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center mx-auto shadow-lg`}>
                    <step.icon className="h-10 w-10" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-md">
                    {index + 1}
                  </div>
                </motion.div>
                <h3 className="text-xl font-semibold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 -right-4 text-muted-foreground/30">
                  <ChevronRight className="h-8 w-8" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForIndividualsSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const benefits = [
    "Keep **all your personal receipts** in one secure place.",
    "Get **smart reminders** before returns and warranties expire.",
    "Store **proof of purchase** for big-ticket items without worrying about paper.",
    "Free to use – forever."
  ];

  const renderBenefit = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <section id="for-individuals" ref={ref} className="py-16 md:py-24 px-4 bg-card/50 overflow-hidden" data-testid="section-for-individuals">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-individuals-title">
              For Individuals: No more shoeboxes, no more faded slips.
            </h2>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.li 
                  key={index} 
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                >
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{renderBenefit(benefit)}</span>
                </motion.li>
              ))}
            </ul>
            {!isAuthenticated && (
              <Link href="/register">
                <Button size="lg" className="gap-2 hover:scale-105 transition-all" data-testid="button-individuals-cta">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </motion.div>

          <motion.div 
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <img 
                src={individualsImage} 
                alt="Person at home managing receipts on their smartphone"
                className="rounded-2xl shadow-xl object-cover w-full h-[400px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
              
              <motion.div 
                className="absolute -bottom-4 -right-4 bg-card border rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Return: 12 days left</span>
                </div>
              </motion.div>
            </div>
            
            <div className="absolute -z-10 -bottom-8 -left-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ForSMMEsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const benefits = [
    "Separate **Business** and **Personal** profiles with their own dashboards.",
    "Capture business expenses from anywhere – owner or staff can upload slips.",
    "Get **VAT and expenditure summaries** by month, merchant and category.",
    "Export **accountant-ready CSV/PDF reports** for tax and year-end.",
    "Track return and warranty deadlines on equipment, tools and stock."
  ];

  const renderBenefit = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <section id="for-businesses" ref={ref} className="py-16 md:py-24 px-4 overflow-hidden" data-testid="section-for-businesses">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            className="relative order-2 lg:order-1"
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <img 
                src={smmesImage} 
                alt="Small business team reviewing finances on laptop"
                className="rounded-2xl shadow-xl object-cover w-full h-[400px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
              
              <motion.div 
                className="absolute -top-4 -left-4 bg-card border rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">VAT Claimable</p>
                    <p className="text-sm font-bold">R3,210</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -bottom-4 -right-4 bg-card border rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Export CSV/PDF</span>
                </div>
              </motion.div>
            </div>
            
            <div className="absolute -z-10 -bottom-8 -right-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          </motion.div>

          <motion.div 
            className="space-y-6 order-1 lg:order-2"
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-businesses-title">
              For SMMEs: VAT, spend and evidence in one place.
            </h2>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.li 
                  key={index} 
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                >
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{renderBenefit(benefit)}</span>
                </motion.li>
              ))}
            </ul>
            <Link href="/pricing">
              <Button size="lg" className="gap-2 hover:scale-105 transition-all" data-testid="button-businesses-cta">
                See Business Plans
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ForRetailersSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const benefits = [
    "**Reduce friction at the returns desk** – staff rely on clear, digital proof instead of deciphering faded paper slips.",
    "**Cut down on fraud and \"friendly fraud\"** – verifiable digital receipts and claims make re-used or manipulated slips much harder.",
    "**Apply policies consistently** – standardise how return and warranty rules are applied across categories, promotions and branches.",
    "**See the post-purchase journey** – gain visibility into returns and claims by customer, category and SKU instead of losing insight once the slip leaves the store."
  ];

  const renderBenefit = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => 
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  return (
    <section id="for-retailers" ref={ref} className="py-16 md:py-24 px-4 bg-card/50 overflow-hidden" data-testid="section-for-retailers">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            className="space-y-6"
            initial={{ opacity: 0, x: -50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-retailers-title">
              For Retailers: Faster returns, less fraud, clearer insight.
            </h2>
            <p className="text-lg text-muted-foreground">
              SlipSafe gives retailers a digital layer over traditional receipts, making returns, warranties and claims faster and more reliable – without forcing a full POS replacement on day one.
            </p>
            <ul className="space-y-4">
              {benefits.map((benefit, index) => (
                <motion.li 
                  key={index} 
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
                >
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">{renderBenefit(benefit)}</span>
                </motion.li>
              ))}
            </ul>
            <Button 
              size="lg" 
              className="gap-2 hover:scale-105 transition-all" 
              onClick={() => scrollToSection('help')} 
              data-testid="button-retailers-cta"
            >
              Talk to us about a pilot
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>

          <motion.div 
            className="relative"
            initial={{ opacity: 0, x: 50 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="relative">
              <img 
                src={retailersImage} 
                alt="Retail staff processing a customer return at service desk"
                className="rounded-2xl shadow-xl object-cover w-full h-[400px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
              
              <motion.div 
                className="absolute -top-4 -right-4 bg-card border rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Scan to verify</span>
                </div>
              </motion.div>
              
              <motion.div 
                className="absolute -bottom-4 -left-4 bg-card border rounded-xl p-3 shadow-lg"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Claim Verified</span>
                </div>
              </motion.div>
            </div>
            
            <div className="absolute -z-10 -bottom-8 -left-8 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function HelpSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const contacts = [
    {
      icon: SiWhatsapp,
      title: "WhatsApp Support",
      description: "Chat with SlipSafe on WhatsApp",
      detail: "076 488 5035",
      href: "https://wa.me/27764885035?text=Hi%20SlipSafe%2C%20I%27d%20like%20to%20know%20more%20about%20your%20app.",
      external: true,
      buttonText: "Chat on WhatsApp",
      iconColor: "text-green-600",
      bgColor: "bg-green-500/10"
    },
    {
      icon: Mail,
      title: "Email",
      description: "Email us",
      detail: "sales@slip-safe.net",
      href: "mailto:sales@slip-safe.net",
      external: false,
      buttonText: "Send Email",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-500/10"
    },
    {
      icon: Phone,
      title: "Phone",
      description: "Call us",
      detail: "076 488 5035",
      subDetail: "Business hours: Mon–Fri, 09:00–17:00 (SAST)",
      href: "tel:+27764885035",
      external: false,
      buttonText: "Call Now",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-500/10"
    },
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Instant support",
      detail: "Use the live chat bubble at the bottom of the screen to message us instantly from the website.",
      href: null,
      external: false,
      buttonText: null,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-500/10",
      pulse: true
    }
  ];

  return (
    <section id="help" ref={ref} className="py-16 md:py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-accent/5" data-testid="section-help">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-12 items-start">
          <motion.div 
            className="lg:col-span-1"
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4" data-testid="text-help-title">
              Need help? We're close by.
            </h2>
            <p className="text-muted-foreground mb-6">
              Our team is ready to assist you with any questions about SlipSafe.
            </p>
            <div className="relative hidden lg:block">
              <img 
                src={supportImage} 
                alt="Friendly customer support team"
                className="rounded-2xl shadow-lg object-cover w-full h-[280px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent rounded-2xl" />
            </div>
          </motion.div>

          <div className="lg:col-span-2 grid md:grid-cols-2 gap-6">
            {contacts.map((contact, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:-translate-y-1 hover:shadow-lg transition-all duration-300" data-testid={`card-contact-${index}`}>
                  <CardContent className="p-6 space-y-4">
                    <div className={`w-12 h-12 rounded-lg ${contact.bgColor} flex items-center justify-center relative`}>
                      <contact.icon className={`h-6 w-6 ${contact.iconColor}`} />
                      {contact.pulse && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                      )}
                    </div>
                    <h3 className="text-lg font-semibold">{contact.title}</h3>
                    <p className="text-sm text-muted-foreground">{contact.description}</p>
                    <p className="text-sm font-medium">{contact.detail}</p>
                    {contact.subDetail && (
                      <p className="text-xs text-muted-foreground">{contact.subDetail}</p>
                    )}
                    {contact.href && (
                      <a 
                        href={contact.href}
                        target={contact.external ? "_blank" : undefined}
                        rel={contact.external ? "noopener noreferrer" : undefined}
                        data-testid={`link-contact-${index}`}
                      >
                        <Button variant="outline" size="sm" className="w-full mt-2 hover:scale-[1.02] transition-transform">
                          {contact.buttonText}
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-card border-t py-12 px-4" data-testid="landing-footer">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="SlipSafe" className="h-8 w-8" />
              <span className="text-lg font-semibold">SlipSafe</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Digitize receipts, manage warranties, and generate verifiable claims with ease.
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-footer-home"
                >
                  Home
                </button>
              </li>
              <li>
                <Link href="/pricing">
                  <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-pricing">
                    Pricing
                  </span>
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => scrollToSection('help')}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="link-footer-help"
                >
                  Help
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms">
                  <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-terms">
                    Terms & Conditions
                  </span>
                </Link>
              </li>
              <li>
                <Link href="/privacy">
                  <span className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="link-footer-privacy">
                    Privacy Policy
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:sales@slip-safe.net" className="hover:text-foreground transition-colors" data-testid="link-footer-email">
                  sales@slip-safe.net
                </a>
              </li>
              <li>
                <a href="tel:+27764885035" className="hover:text-foreground transition-colors" data-testid="link-footer-phone">
                  076 488 5035
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          <p data-testid="text-copyright">
            © SlipSafe. All rights reserved. Made in South Africa.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const { user, isAuthenticated, logout } = useAuth();
  
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  } as React.CSSProperties;

  const getDisplayName = () => {
    if (user?.activeContext === "business" && user?.businessName) {
      return user.businessName;
    }
    return user?.fullName || "User";
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex min-h-screen w-full" data-testid="page-landing">
        <LandingSidebar 
          isAuthenticated={isAuthenticated} 
          user={user || null} 
          onLogout={logout}
        />
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-40 flex h-auto items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
            <div className="flex items-center gap-3 md:hidden">
              <SidebarTrigger data-testid="button-mobile-menu" />
            </div>
            
            <div className={`flex items-center justify-center md:hidden ${isAuthenticated ? '' : 'flex-1 -ml-8'}`}>
              <img src={logo} alt="SlipSafe" className="h-20 w-20 sm:h-24 sm:w-24 object-contain" data-testid="img-header-logo" />
            </div>
            
            {isAuthenticated && (
              <div className="flex items-center gap-3 ml-auto" data-testid="header-user-info">
                <span className="text-sm hidden sm:block">
                  Hi, <span className="font-medium">{getDisplayName()}</span>
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </header>
          <div className="flex-1 overflow-auto">
            <HeroSection isAuthenticated={isAuthenticated} />
            <AudiencesSection />
            <HowItWorksSection />
            <ForIndividualsSection isAuthenticated={isAuthenticated} />
            <ForSMMEsSection />
            <ForRetailersSection />
            <HelpSection />
            <Footer />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
