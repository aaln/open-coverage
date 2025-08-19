"use client";

import { MemberCard, UtilizationAnalysis } from "@/components/health-profile";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useHealthProfileStore, type Member } from "@/lib/health-profile-store";
import {
  ScreenReaderAnnouncement,
  useScreenReaderAnnouncement,
} from "@/lib/hooks/use-screen-reader";
import { calculateHealthcareUtilization } from "@/lib/utilization-engine";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function HealthProfilePage() {
  const { members, addMember, removeMember, updateMember, clearProfile } =
    useHealthProfileStore();
  const [showUtilization, setShowUtilization] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const { announce, announcementRef } = useScreenReaderAnnouncement();
  const [isHydrated, setIsHydrated] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>(
    {}
  );

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Calculate utilization for all members
  const memberUtilizations = useMemo(() => {
    return members.map((member) => ({
      memberId: member.id,
      memberName: member.age ? `Member (Age ${member.age})` : "Member",
      utilization: member.age ? calculateHealthcareUtilization(member) : null,
      hasConditions:
        member.conditions &&
        member.conditions.length > 0 &&
        !member.conditions.includes("NONE"),
      hasBasicData: Boolean(member.age && member.age.trim() !== ""),
    }));
  }, [members]);

  // Set default selected member when members change
  React.useEffect(() => {
    if (!selectedMemberId || !members.find((m) => m.id === selectedMemberId)) {
      const firstMemberWithData = members.find(
        (m) => m.age && m.age.trim() !== ""
      );
      setSelectedMemberId(firstMemberWithData?.id || members[0]?.id || "");
    }
  }, [members, selectedMemberId]);

  // Auto-show utilization if any member has sufficient data
  React.useEffect(() => {
    const hasMemberWithData = memberUtilizations.some(
      (mu) => mu.utilization && mu.hasBasicData
    );
    if (hasMemberWithData) {
      setShowUtilization(true);
    }
  }, [memberUtilizations]);

  // Calculate profile completeness for basic profile
  const calculateBasicCompleteness = (member: Member) => {
    // Demographics scoring (age, gender, height, weight)
    const demographics = [
      member.age && member.age.trim() !== "" ? 25 : 0,
      member.gender && member.gender !== "prefer_not_to_say" ? 25 : 0,
      member.height && member.height > 0 ? 25 : 0,
      member.weight && member.weight > 0 ? 25 : 0,
    ].reduce((a, b) => a + b, 0);

    // Conditions scoring - 100% if at least one condition is added OR explicitly marked as "NONE"
    const conditions =
      member.conditions && member.conditions.length > 0 ? 100 : 0;

    // Medications scoring - 100% if at least one medication is added OR explicitly marked as "NONE"
    const medications =
      member.medications && member.medications.length > 0 ? 100 : 0;

    // History scoring - 100% if allergies are specified (including "NONE")
    const history = member.allergies && member.allergies.length > 0 ? 100 : 0;

    // Preferences scoring (lifestyle factors only, medical services optional)
    // Count as answered if user has selected any value
    const lifestyleFactors = [
      member.smokingStatus !== undefined ? 1 : 0,
      member.alcoholUse !== undefined ? 1 : 0,
      member.exerciseFrequency !== undefined ? 1 : 0,
    ];
    const answeredCount = lifestyleFactors.reduce((a, b) => a + b, 0);
    const preferences =
      answeredCount === 3 ? 100 : Math.round((answeredCount / 3) * 100);

    // Calculate overall score (average of all categories, excluding providers)
    const overall =
      (demographics + conditions + medications + history + preferences) / 5;

    return {
      overall: Math.round(overall),
      categories: {
        demographics: Math.round(demographics),
        conditions: Math.round(conditions),
        medications: Math.round(medications),
        providers: 0, // Not used but kept for compatibility
        history: Math.round(history),
        preferences: Math.round(preferences),
      },
    };
  };

  // Handle member addition with announcement
  const handleAddMember = () => {
    addMember();
    announce(`New family member added. Total members: ${members.length + 1}`);
  };

  // Handle member removal with announcement
  const handleRemoveMember = useCallback(
    (memberId: string, index: number) => {
      removeMember(memberId);
      announce(`Member ${index + 1} removed from health profile`);
    },
    [removeMember, announce]
  );

  // Toggle card collapse state
  const toggleCardCollapse = useCallback((memberId: string) => {
    setCollapsedCards((prev) => ({
      ...prev,
      [memberId]: !prev[memberId],
    }));
  }, []);

  // Check if card is collapsed (default to open for first member, closed for others)
  const isCardCollapsed = (memberId: string, index: number) => {
    return collapsedCards[memberId] ?? index > 0;
  };

  // Memoize the updateMember callback to prevent infinite loops
  const handleUpdateMember = useCallback(
    (memberId: string, updates: Partial<Member>) => {
      updateMember(memberId, updates);
    },
    [updateMember]
  );

  return (
    <SidebarInset>
      <ScreenReaderAnnouncement announcementRef={announcementRef} />
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Health Profile</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Health Profile
              </h1>
              <p className="text-gray-600">
                Add your healthcare information to get personalized insurance
                analysis and recommendations.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  (window.location.href = "/utilization-model-test")
                }
                className="text-blue-600 hover:text-blue-700 border-blue-200 hover:border-blue-300"
              >
                Try our new model here
              </Button>
              <Button
                variant="outline"
                onClick={clearProfile}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {members.map((member, index) => (
              <MemberCard
                key={member.id}
                member={member}
                index={index}
                isCollapsed={isCardCollapsed(member.id, index)}
                canRemove={members.length > 1}
                onUpdate={handleUpdateMember}
                onRemove={handleRemoveMember}
                onToggleCollapse={toggleCardCollapse}
              />
            ))}
          </div>

          <Button
            onClick={handleAddMember}
            variant="outline"
            className="w-full mb-6 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Add new family member to health profile"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Family Member
          </Button>

          {/* Profile Completeness Summary */}
          {/* {isHydrated && members.length > 0 && members[0] && (
            <div className="mb-6">
              <ProfileCompleteness 
                overallScore={calculateBasicCompleteness(members[0]).overall}
                categories={calculateBasicCompleteness(members[0]).categories}
                memberName={members[0].age ? `Primary Member (Age ${members[0].age})` : "Primary Member"}
              />
            </div>
          )} */}

          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-gray-500">
              Your health profile is automatically saved to your browser
            </p>
            <div className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? "s" : ""} in
              profile
            </div>
          </div>

          <UtilizationAnalysis
            memberUtilizations={memberUtilizations}
            members={members}
            showUtilization={showUtilization}
            selectedMemberId={selectedMemberId}
            onToggleUtilization={() => setShowUtilization(!showUtilization)}
            onSelectMember={setSelectedMemberId}
          />
        </div>
      </div>
    </SidebarInset>
  );
}
