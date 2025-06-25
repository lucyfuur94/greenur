import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  ArrowRight, 
  Sun, 
  Moon, 
  Monitor, 
  LogOut,
  Home,
  User,
  Leaf,
  Bell,
  Loader2
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useOnboarding } from "@/lib/OnboardingContext";
import { useTheme } from "@/lib/ThemeContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface ProfilePageProps {
  onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { userPreferences, updateUserPreferences } = useOnboarding();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tempPreferences, setTempPreferences] = useState({
    name: '',
    gardenType: ''
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  // Get user display name or email
  const getUserDisplayName = () => {
    if (!currentUser) return "User";
    return currentUser.displayName || "User";
  };

  // Get user email
  const getUserEmail = () => {
    if (!currentUser) return "";
    return currentUser.email || "";
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!currentUser) return "U";
    if (currentUser.displayName) {
      const nameParts = currentUser.displayName.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return currentUser.displayName[0].toUpperCase();
    }
    return currentUser.email ? currentUser.email[0].toUpperCase() : "U";
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem signing you out.",
        variant: "destructive",
      });
    }
  };

  const startEditing = (field: string) => {
    setEditing(field);
    if (field === 'name') {
      setTempPreferences(prev => ({ ...prev, name: userPreferences?.name || '' }));
    } else if (field === 'gardenType') {
      setTempPreferences(prev => ({ ...prev, gardenType: userPreferences?.gardenType || 'indoor' }));
    }
  };

  const saveChanges = async (field: string) => {
    try {
      if (field === 'name') {
        await updateUserPreferences({ name: tempPreferences.name });
        
        // Also update Firebase display name
        if (currentUser) {
          await fetch('/netlify/functions/update-user-profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: currentUser.uid,
              displayName: tempPreferences.name
            })
          });
        }
      } else if (field === 'gardenType') {
        await updateUserPreferences({ gardenType: tempPreferences.gardenType as 'indoor' | 'outdoor' | 'both' });
      }
      
      setEditing(null);
      toast({
        title: "Updated",
        description: "Your profile has been updated.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem updating your profile.",
        variant: "destructive",
      });
    }
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  // Handle profile image change
  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImageFile(file);
    }
  };

  // Upload profile image
  const uploadProfileImage = async () => {
    if (!profileImageFile || !currentUser) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', profileImageFile);
      formData.append('userId', currentUser.uid);
      
      const response = await fetch('/netlify/functions/upload-profile-image', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload profile image');
      }
      
      // Force refresh of the user object
      window.location.reload();
      
      toast({
        title: "Image Uploaded",
        description: "Your profile image has been updated.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error uploading profile image:', error);
      toast({
        title: "Upload Failed",
        description: "There was a problem uploading your profile image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProfileImageFile(null);
    }
  };

  // Remove profile image
  const removeProfileImage = async () => {
    if (!currentUser) return;
    
    setUploading(true);
    
    try {
      const response = await fetch('/netlify/functions/remove-profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: currentUser.uid
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove profile image');
      }
      
      // Force refresh to update the UI
      window.location.reload();
      
      toast({
        title: "Image Removed",
        description: "Your profile image has been removed.",
        variant: "default",
      });
    } catch (error) {
      console.error('Error removing profile image:', error);
      toast({
        title: "Error",
        description: "There was a problem removing your profile image.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Helper function to format gardening experience
  const formatExperience = (experience: string | undefined) => {
    if (!experience) return "Beginner";
    switch (experience) {
      case 'beginner': return "Beginner";
      case 'intermediate': return "Intermediate";
      case 'expert': return "Expert";
      default: return experience;
    }
  };

  // Helper function to format garden type
  const formatGardenType = (type: string | undefined) => {
    if (!type) return "Indoor";
    switch (type) {
      case 'indoor': return "Indoor";
      case 'outdoor': return "Outdoor";
      case 'both': return "Indoor & Outdoor";
      default: return type;
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center px-4 py-3 border-b border-border bg-background">
          <Button
            variant="ghost"
            className="rounded-full hover:bg-accent hover:text-accent-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold ml-2 text-foreground">Profile</h1>
        </div>
        {/* Profile Content */}
        <div className="flex-1 p-4 space-y-4 overflow-auto">
          {/* User Info Card */}
          <Card className="p-4 shadow-md bg-card border-border">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                  <AvatarImage src={currentUser?.photoURL || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground">{getUserInitials()}</AvatarFallback>
                </Avatar>
                <label htmlFor="profile-image-upload" className="absolute -bottom-1 -right-1 bg-background border border-border p-1 rounded-full cursor-pointer shadow-md hover:bg-accent">
                  <User className="w-4 h-4 text-primary" />
                  <input 
                    id="profile-image-upload" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfileImageChange}
                  />
                </label>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-card-foreground">
                    {userPreferences?.name || getUserDisplayName()}
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:bg-accent hover:text-accent-foreground"
                    onClick={() => startEditing('name')}
                  >
                    Edit
                  </Button>
                </div>
                <p className="text-muted-foreground">{getUserEmail()}</p>
                
                {profileImageFile && (
                  <div className="mt-2 flex items-center">
                    <Button 
                      size="sm" 
                      className="mr-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={uploadProfileImage}
                      disabled={uploading}
                    >
                      {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      Upload Image
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setProfileImageFile(null)}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                )}
                
                {!profileImageFile && currentUser?.photoURL && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={removeProfileImage}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Remove Image
                  </Button>
                )}
              </div>
            </div>
            
            {editing === 'name' && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">Display Name</Label>
                <Input 
                  id="name"
                  value={tempPreferences.name} 
                  onChange={(e) => setTempPreferences(prev => ({ ...prev, name: e.target.value }))} 
                  className="mt-1"
                />
                <div className="flex justify-end space-x-2 mt-3">
                  <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => saveChanges('name')}>Save</Button>
                </div>
              </div>
            )}
          </Card>

          {/* Gardening Preferences */}
          <Card className="shadow-md bg-card border-border">
            <div className="p-4 border-b border-border">
              <h3 className="text-md font-medium text-card-foreground">Gardening Preferences</h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Experience Level */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-3">
                    <Leaf className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Experience Level</p>
                    <p className="font-medium text-card-foreground">{formatExperience(userPreferences?.experience)}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-primary hover:bg-accent hover:text-accent-foreground"
                  onClick={() => startEditing('experience')}
                >
                  Change
                </Button>
              </div>

              {/* Garden Type */}
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-3">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Garden Type</p>
                    <p className="font-medium text-card-foreground">{formatGardenType(userPreferences?.gardenType)}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-primary hover:bg-accent hover:text-accent-foreground"
                  onClick={() => startEditing('gardenType')}
                >
                  Change
                </Button>
              </div>

              {editing === 'gardenType' && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Garden Type</Label>
                  <Select 
                    value={tempPreferences.gardenType} 
                    onValueChange={(value) => setTempPreferences(prev => ({ ...prev, gardenType: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select garden type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indoor">Indoor</SelectItem>
                      <SelectItem value="outdoor">Outdoor</SelectItem>
                      <SelectItem value="both">Indoor & Outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end space-x-2 mt-3">
                    <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => saveChanges('gardenType')}>Save</Button>
                  </div>
                </div>
              )}
              
              {editing === 'experience' && (
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Experience Level</Label>
                  <Select 
                    value={userPreferences?.experience || 'beginner'} 
                    onValueChange={(value) => updateUserPreferences({ experience: value as 'beginner' | 'intermediate' | 'expert' })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex justify-end space-x-2 mt-3">
                    <Button variant="outline" size="sm" onClick={cancelEditing}>Cancel</Button>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setEditing(null)}>Save</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Theme Selector */}
          <Card className="p-4 shadow-md bg-card border-border">
            <h3 className="text-sm font-medium mb-3 text-card-foreground">Theme</h3>
            <div className="flex space-x-2">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <Button
                  key={t}
                  variant={theme === t ? "default" : "outline"}
                  className={`flex-1 capitalize rounded-xl ${
                    theme === t ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                  }`}
                  onClick={() => setTheme(t)}
                >
                  <span className="mr-2">
                    {t === 'light' ? <Sun className="w-4 h-4" /> : t === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                  </span>
                  {t}
                </Button>
              ))}
            </div>
          </Card>

          {/* Profile Options */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl shadow-sm hover:shadow-md transition-shadow bg-card hover:bg-accent"
            >
              <div className="flex items-center">
                <User className="w-5 h-5 mr-2 text-primary" />
                <span className="text-card-foreground">Account Settings</span>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button
              variant="outline"
              className="w-full justify-between rounded-xl shadow-sm hover:shadow-md transition-shadow bg-card hover:bg-accent"
              onClick={() => console.log('Notification preferences')}
            >
              <div className="flex items-center">
                <Bell className="w-5 h-5 mr-2 text-primary" />
                <span className="text-card-foreground">Notification Preferences</span>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>

          {/* Sign Out Button */}
          <Button
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage; 