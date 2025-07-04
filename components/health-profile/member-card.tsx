"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { Member } from "@/lib/health-profile-store"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, User, X } from "lucide-react"
import { useCallback } from "react"

import { BasicInformation } from "./basic-information"
import { LifestyleFactors } from "./lifestyle-factors"
import { MedicalInformation } from "./medical-information"
import { OtherServicesInput } from "./other-services-input"
import { PregnancyInformation } from "./pregnancy-information"

interface MemberCardProps {
  member: Member
  index: number
  isCollapsed: boolean
  canRemove: boolean
  onUpdate: (memberId: string, updates: Partial<Member>) => void
  onRemove: (memberId: string, index: number) => void
  onToggleCollapse: (memberId: string) => void
}

export function MemberCard({
  member,
  index,
  isCollapsed,
  canRemove,
  onUpdate,
  onRemove,
  onToggleCollapse
}: MemberCardProps) {
  // Create stable callbacks for child components
  const handleUpdate = useCallback((updates: Partial<Member>) => {
    onUpdate(member.id, updates)
  }, [member.id, onUpdate])
  
  const handleRemove = useCallback(() => {
    onRemove(member.id, index)
  }, [member.id, index, onRemove])
  
  const handleToggleCollapse = useCallback(() => {
    onToggleCollapse(member.id)
  }, [member.id, onToggleCollapse])
  
  // Prevent onOpenChange from being called during render
  // Only handle user-initiated changes, not prop-driven changes
  const handleCollapsibleChange = useCallback((newOpen: boolean) => {
    // The Collapsible is controlled by !isCollapsed
    // So when newOpen is true, isCollapsed should be false
    // Only trigger the callback if this represents an actual user interaction
    if (newOpen !== !isCollapsed) {
      handleToggleCollapse()
    }
  }, [isCollapsed, handleToggleCollapse])
  
  return (
    <Card className={cn("w-full transition-all", isCollapsed && "bg-gray-50 border-gray-200")}>
      <Collapsible open={!isCollapsed} onOpenChange={handleCollapsibleChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="p-1">
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-4 h-4" />
                {index === 0 ? "Primary Member" : `Member ${index + 1}`}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {member.age && (
                  <Badge variant="secondary" className="text-xs">
                    Age {member.age}
                  </Badge>
                )}
                {member.gender && member.gender !== 'prefer_not_to_say' && (
                  <Badge variant="outline" className="text-xs">
                    {member.gender.charAt(0).toUpperCase() + member.gender.slice(1)}
                  </Badge>
                )}
                {isCollapsed && member.conditions && member.conditions.length > 0 && !member.conditions.includes("NONE") && (
                  <Badge variant="destructive" className="text-xs">
                    {member.conditions.length} condition{member.conditions.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {isCollapsed && member.medications && member.medications.length > 0 && !member.medications.includes("NONE") && (
                  <Badge variant="default" className="text-xs">
                    {member.medications.length} medication{member.medications.length !== 1 ? 's' : ''}
                  </Badge>
                )}
                {isCollapsed && member.pregnancyStatus?.isPregnant && (
                  <Badge variant="secondary" className="text-xs bg-pink-100 text-pink-800">
                    Pregnant
                  </Badge>
                )}
              </div>
            </div>
            {canRemove && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                aria-label={`Remove ${index === 0 ? "Primary Member" : `Member ${index + 1}`}`}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            <BasicInformation member={member} onUpdate={handleUpdate} />
            
            <LifestyleFactors member={member} onUpdate={handleUpdate} />

            <PregnancyInformation member={member} onUpdate={handleUpdate} />

            <MedicalInformation member={member} onUpdate={handleUpdate} />
            
            <OtherServicesInput 
              services={member.otherServices || []} 
              onServicesChange={(otherServices) => handleUpdate({ otherServices })} 
            />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
} 